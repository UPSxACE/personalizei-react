import axios from "axios";
import "server-only";

const serverApi = axios.create({
  baseURL: process.env.SERVER_API_URL,
  timeout: 300000,
  withCredentials: true,
  headers: {
    Authorization: process.env.AUTH_HEADER,
  },
});

export default serverApi;
