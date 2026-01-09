// This file must be imported first to register path aliases
import { register } from "tsconfig-paths";
import * as path from "path";

// When running from compiled code in lib/, __dirname will be functions/lib
// We need to resolve paths to lib/*, not src/*
const baseUrl = path.resolve(__dirname, "..");

register({
  baseUrl,
  paths: {
    "@/*": [path.join(baseUrl, "lib", "*")],
  },
});
