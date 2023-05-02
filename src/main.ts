/*
* Stromee+ Cloud-Adapter for ioBroker
* Created on 23.04.2023 Lutz Helling 
* Created with @iobroker/create-adapter v2.4.0
*/

import * as utils from "@iobroker/adapter-core";
import { request } from "node:https";


class Stromee extends utils.Adapter {

	private t1!: any;
	private auth: any = {};
	private token = "";

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "stromee",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.debug("config deviceId: " + this.config.deviceId);
		this.log.debug("config deviceName: " + this.config.deviceName);
		this.log.debug("config user: " + this.config.user);
		this.log.debug("config password: " + this.config.password);
		this.log.debug("config updateFreq: " + this.config.updateFreq);

		await this.setObjectNotExistsAsync("letzterStand", {
			type: "state",
			common: {
				name: "Letzter abgelesener Stand",
				type: "number",
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		this.doIt();

		this.t1 = this.setInterval(() => {
			this.doIt();
		}, this.config.updateFreq * 1000);
	}

	private doIt = (): void => {
		this.log.info("Getting data from Stromee+-Cloud...");
		if (this.isTokenInvalid()) {
			this.log.info("Token is invalid, new token needed...")
			this.getToken((response: Buffer) => {
				this.auth = JSON.parse(response.toString());
				if (this.isTokenInvalid()) {
					this.log.info("Token could not be gained from Stromee+");
					return;
				}
				this.token = this.auth.authentication.authenticationToken;
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				this.getStaende(this.token, (response: Buffer) => {
					const measurements = JSON.parse(response.toString());
					measurements.forEach(async (e: any) => {
						this.log.debug(JSON.stringify(e));
						if (e.measurement == this.config.deviceId) {
							const tsKlartext = new Date(Number(e.timestamp)).toLocaleString();
							this.log.debug("Letzter Stand:" + e.value + " - " + tsKlartext);
							await this.setState("letzterStand", Number(e.value), true, (err) => {
								// analyse if the state could be set (because of permissions)
								if (err) this.log.error(err.toString());
							});
						}
					});
				});
			});
		} else {
			this.getStaende(this.token, (response: Buffer) => {
				const measurements = JSON.parse(response.toString());
				measurements.forEach(async (e: any) => {
					this.log.debug(JSON.stringify(e));
					if (e.measurement == this.config.deviceName) {
						const tsKlartext = new Date(Number(e.timestamp)).toLocaleString();
						this.log.debug("Letzter Stand:" + e.value + " - " + tsKlartext);
						await this.setStateAsync("letzterStand", Number(e.value));
					}
				});
			});

		}
	}

	private isTokenInvalid(): boolean {
		if (!this.auth.hasOwnProperty("authentication")) {
			return true;
		}
		this.log.debug("Token already gained..." + JSON.stringify(this.auth));
		const maxAgeInt = Number(this.auth.authentication.expiresAt);
		this.log.debug("maxAge:" + maxAgeInt);
		this.log.debug("now:" + (new Date().getTime()))
		this.log.debug("limit:" + (new Date().getTime() + 1000))
		const ret = !(maxAgeInt < (new Date().getTime() + 1000));
		this.log.debug("token is valid:" + !ret);
		return ret;
	}

	private getStaende(token: any, callback: (buf: Buffer) => void): void {
		const options = {
			"method": "GET",
			"hostname": "backend.stromee-plus.stromee.de",
			"path": "/api/v1/devices/" + this.config.deviceName + "/measurements/latest?start=-6m",
			"headers": {
				"Authorization": "Bearer " + token
			},
			"maxRedirects": 20
		};

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const _self = this;

		const req = request(options, function (res) {
			const chunks: any = [];

			res.on("data", function (chunk) {
				chunks.push(chunk);
			});

			res.on("end", function () {
				const body = Buffer.concat(chunks);
				_self.log.debug(body.toString());
				callback(body);
			});

			res.on("error", function (error) {
				_self.log.debug(error.message);
			});
		});

		req.end();
	}

	private getToken(callback: (res: Buffer) => any): void {
		try {

			const options = {
				"method": "POST",
				"hostname": "backend.staging.stromee.de",
				"path": "/v0.1/account/login",
				"headers": {
					"Accept": "application/json, text/plain, */*",
					"Content-Type": "application/json",
				},
				"maxRedirects": 20
			};

			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const _self = this;
			const req = request(options, function (res) {
				const chunks: any[] = [];

				res.on("data", function (chunk) {
					chunks.push(chunk);
				});

				res.on("end", function () {
					const body = Buffer.concat(chunks);
					_self.log.debug(body.toString());
					callback(body);
				});

				res.on("error", function (error) {
					console.error(error);
				});
			});

			const postData = JSON.stringify({
				"username": this.config.user,
				"email": this.config.user,
				"password": this.config.password,
				"skipPowercloud": true
			});

			req.write(postData);

			req.end();
		} finally {
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			clearInterval(this.t1);
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  */
	// private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	// private onMessage(obj: ioBroker.Message): void {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Stromee(options);
} else {
	// otherwise start the instance directly
	(() => new Stromee())();
}