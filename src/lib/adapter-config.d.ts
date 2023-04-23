// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			deviceId: string;
			deviceName: string;
			user: string;
			password: string;
			updateFreq: number;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export { };