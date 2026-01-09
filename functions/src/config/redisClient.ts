import { createClient } from "redis";

const redisClient = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: "redis-14508.c252.ap-southeast-1-1.ec2.cloud.redislabs.com",
    port: 14508,
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

let isConnected = false;

export const connectRedis = async () => {
  if (!isConnected) {
    await redisClient.connect();
    isConnected = true;
    console.log("Redis connected");
  }
};

export default redisClient;
