import Redis from "ioredis";
import "server-only";
import { z } from "zod";
import { Mutex } from "./mutex";
import sleep from "./utils/sleep";

const redis = new Redis({
  host: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  db: process.env.NODE_ENV === "production" ? 0 : 15,
  maxRetriesPerRequest: 0, // NOTE: read: https://github.com/redis/ioredis/issues/1686#issuecomment-1335957159
});
const backgroundRedis = new Redis({
  host: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  db: process.env.NODE_ENV === "production" ? 0 : 15,
  maxRetriesPerRequest: 0, // NOTE: read: https://github.com/redis/ioredis/issues/1686#issuecomment-1335957159
});

const luaMissingKeysScript = `
        local missing_keys = {}

        for i, key in ipairs(KEYS) do
            if redis.call('EXISTS', key) == 0 then
                table.insert(missing_keys, key)
            end
        end

        return missing_keys
    `;

const luaAllHashFieldsExistScript = `
        local hash_key = KEYS[1]

        for i = 2, #KEYS do
            local field = KEYS[i]
            if redis.call('HEXISTS', hash_key, field) == 0 then
                return 0 -- One of the fields does not exist
            end
        end

        return 1 -- All fields exist
`;

redis.defineCommand("missingKeys", {
  lua: luaMissingKeysScript,
});
backgroundRedis.defineCommand("missingKeys", {
  lua: luaMissingKeysScript,
});
redis.defineCommand("allHashFieldsExist", {
  lua: luaAllHashFieldsExistScript,
});
backgroundRedis.defineCommand("allHashFieldsExist", {
  lua: luaAllHashFieldsExistScript,
});

declare module "ioredis" {
  interface Redis {
    missingKeys: (
      argsNumber: number,
      ...keys: string[]
    ) => Promise<string[] | null>;
    allHashFieldsExist: (
      argsNumber: number,
      hash: string,
      ...keys: (string | number)[]
    ) => Promise<1 | 0 | null>;
  }
}

const redisMutex = new Mutex();
const backgroundRedisMutex = new Mutex();

export function getRedisMutex(onBackground: boolean = false) {
  return onBackground ? backgroundRedisMutex : redisMutex;
}
/** Even though this allows to pick between the normal redis instance, and the background redis instance,
    dont forget that by nature the redis client commands are NON LOCKING.

    Therefore any command executed directly by the instance (without wrapping in a mutex.runExclusive call)
    will be imediattly executed.

    If you desire locking behavior, wrap in a mutex.runExclusive call. 
*/
export function getRedisInstance(onBackground: boolean = false) {
  return onBackground ? backgroundRedis : redis;
}

if (process.env.NODE_ENV === "production") {
  // Close Redis connection when the process is exiting
  process.on("SIGINT", async () => {
    console.log("Closing Redis connection on SIGINT...");
    await redis.quit(); // Gracefully close Redis connection
    await backgroundRedis.quit(); // Gracefully close Redis connection
    console.log("Redis connection closed.");
  });

  // Handle other signals like SIGTERM if needed
  process.on("SIGTERM", async () => {
    console.log("Closing Redis connection on SIGTERM...");
    await redis.quit(); // Gracefully close Redis connection
    await backgroundRedis.quit(); // Gracefully close Redis connection
    console.log("Redis connection closed.");
  });
}

// fetchCallback is executed BEFORE the transaction. Therefore it's safe to run other sets/gets that are completely dependent on the main
export async function cachedValue<T>(
  cacheKey: string,
  schema: z.ZodType<T>,
  fetchCallback: () => Promise<T>,
  config: {
    expirationSeconds?: number | null;
    inBackground?: boolean;
    additionalWatch?: string[];
  } = {}
): Promise<T> {
  const {
    inBackground = false,
    additionalWatch = [],
    expirationSeconds = null,
  } = config;

  const mutex = inBackground ? backgroundRedisMutex : redisMutex;
  const instance = inBackground ? backgroundRedis : redis;

  return await mutex
    .runExclusive(async () => {
      await instance.watch([cacheKey, ...additionalWatch]);
      let attempts = 0;
      while (attempts < 10) {
        attempts++;

        const cache = await instance.get(cacheKey);

        const parsedData = schema.safeParse(
          JSON.parse(typeof cache === "string" ? cache : "null")
        );

        if (!parsedData.success) {
          const newData = await fetchCallback();
          const transaction = expirationSeconds
            ? await redis
                .multi()
                .setex(cacheKey, expirationSeconds, JSON.stringify(newData))
                .exec()
            : await redis.multi().set(cacheKey, JSON.stringify(newData)).exec();
          if (transaction === null) {
            // operation failed due to WATCH
            await sleep(100);
            continue;
          }
          const [error] = transaction[0];
          if (error) {
            throw error;
          }
          return newData;
        }

        return parsedData.data;
      }
      throw new Error("Redis transaction keeps failing");
    })
    .then(async (result) => {
      await instance.unwatch();
      return result;
    })
    .catch(async (err) => {
      await instance.unwatch();
      throw err;
    });
}

export async function cachedHashValue<T>(
  hashKey: string,
  cacheKey: string,
  schema: z.ZodType<T>,
  fetchCallback: () => Promise<T>,
  config: {
    inBackground?: boolean;
    checkContinue?: () => Promise<boolean>;
    additionalWatch?: string[];
  } = {}
): Promise<T> {
  const {
    inBackground = false,
    checkContinue = async () => true,
    additionalWatch = [],
  } = config;

  const mutex = inBackground ? backgroundRedisMutex : redisMutex;
  const instance = inBackground ? backgroundRedis : redis;

  return await mutex
    .runExclusive(async () => {
      await instance.watch([cacheKey, ...additionalWatch]);
      let attempts = 0;
      while (attempts < 10) {
        if ((await checkContinue()) === false) {
          throw new Error("Interrupted by checkContinue()");
        }
        attempts++;

        const cache = await instance.hget(hashKey, cacheKey);

        const parsedData = schema.safeParse(
          JSON.parse(typeof cache === "string" ? cache : "null")
        );

        if (!parsedData.success) {
          const newData = await fetchCallback();
          const transaction = await redis
            .multi()
            .hset(hashKey, cacheKey, JSON.stringify(newData))
            .exec();
          if (transaction === null) {
            // operation failed due to WATCH
            await sleep(100);
            continue;
          }
          const [error] = transaction[0];
          if (error) {
            throw error;
          }
          return newData;
        }

        return parsedData.data;
      }
      throw new Error("Redis transaction keeps failing");
    })
    .then(async (result) => {
      await instance.unwatch();
      return result;
    })
    .catch(async (err) => {
      await instance.unwatch();
      throw err;
    });
}

// export async function invalidateCachedValue(cacheKey: string) {
//   return await redis.set(cacheKey + "@last-update", Date.now());
// }

export async function deleteMatchingHashFields(hashKey: string, match: RegExp) {
  // Step 1: Get all the fields in the hash
  const fields = await redis.hkeys(hashKey);
  // Step 2: Filter fields that match the regex
  const matchingFields = fields.filter((field) => match.test(field));

  // Step 3: Delete the matching fields
  if (matchingFields.length > 0) {
    await redis.hdel(hashKey, ...matchingFields);
  }
}
