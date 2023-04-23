"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_node_https = require("node:https");
class Stromee extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "stromee"
    });
    this.token = {};
    this.doIt = () => {
      this.log.info("Getting data from Stromee+-Cloud...");
      if (this.isTokenInvalid()) {
        this.getToken((response) => {
          const auth = JSON.parse(response.toString());
          const token = auth.authentication.authenticationToken;
          this.getStaende(token, (response2) => {
            const measurements = JSON.parse(response2.toString());
            measurements.forEach((e) => {
              this.log.debug(JSON.stringify(e));
              if (e.measurement == this.config.deviceId) {
                const tsKlartext = new Date(Number(e.timestamp)).toLocaleString();
                this.log.debug("Letzter Stand:" + e.value + " - " + tsKlartext);
                this.setState("letzterStand", Number(e.value));
              }
            });
          });
        });
      } else {
        this.getStaende(this.token.authentication.authenticationToken, (response) => {
          const measurements = JSON.parse(response.toString());
          measurements.forEach((e) => {
            this.log.debug(JSON.stringify(e));
            if (e.measurement == this.config.deviceName) {
              const tsKlartext = new Date(Number(e.timestamp)).toLocaleString();
              this.log.debug("Letzter Stand:" + e.value + " - " + tsKlartext);
              this.setState("letzterStand", Number(e.value));
            }
          });
        });
      }
    };
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    this.log.info("config deviceId: " + this.config.deviceId);
    this.log.info("config deviceName: " + this.config.deviceName);
    this.log.info("config user: " + this.config.user);
    this.log.info("config password: " + this.config.password);
    this.log.info("config updateFreq: " + this.config.updateFreq);
    await this.setObjectNotExistsAsync("letzterStand", {
      type: "state",
      common: {
        name: "Letzter abgelesener Stand",
        type: "number",
        role: "indicator",
        read: true,
        write: true
      },
      native: {}
    });
    this.t1 = this.setInterval(() => {
      this.doIt();
    }, this.config.updateFreq * 1e3);
  }
  isTokenInvalid() {
    if (!this.token.hasOwnProperty("authentication")) {
      return true;
    }
    this.log.debug("token is valid..." + JSON.stringify(this.token));
    const maxAgeInt = Number(this.token.authentication.expiresAt);
    this.log.debug("maxAge:" + new Date(maxAgeInt).toLocaleString());
    return !(maxAgeInt < new Date().getTime() - 1e3);
  }
  getStaende(token, callback) {
    const options = {
      "method": "GET",
      "hostname": "backend.stromee-plus.stromee.de",
      "path": "/api/v1/devices/" + this.config.deviceName + "/measurements/latest?start=-6m",
      "headers": {
        "Authorization": "Bearer " + token
      },
      "maxRedirects": 20
    };
    const _self = this;
    const req = (0, import_node_https.request)(options, function(res) {
      const chunks = [];
      res.on("data", function(chunk) {
        chunks.push(chunk);
      });
      res.on("end", function() {
        const body = Buffer.concat(chunks);
        _self.log.info(body.toString());
        callback(body);
      });
      res.on("error", function(error) {
        _self.log.info(error.message);
      });
    });
    req.end();
  }
  getToken(callback) {
    try {
      const options = {
        "method": "POST",
        "hostname": "backend.staging.stromee.de",
        "path": "/v0.1/account/login",
        "headers": {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json"
        },
        "maxRedirects": 20
      };
      const _self = this;
      const req = (0, import_node_https.request)(options, function(res) {
        const chunks = [];
        res.on("data", function(chunk) {
          chunks.push(chunk);
        });
        res.on("end", function() {
          const body = Buffer.concat(chunks);
          _self.log.info(body.toString());
          callback(body);
        });
        res.on("error", function(error) {
          console.error(error);
        });
      });
      const postData = JSON.stringify({
        "username": this.config.user,
        "password": this.config.password,
        "skipPowercloud": true
      });
      req.write(postData);
      req.end();
    } finally {
    }
  }
  onUnload(callback) {
    try {
      this.clearTimeout(this.t1);
      callback();
    } catch (e) {
      callback();
    }
  }
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Stromee(options);
} else {
  (() => new Stromee())();
}
//# sourceMappingURL=main.js.map
