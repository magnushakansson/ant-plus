/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class CadenceSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	CadenceEventTime: number;
	CumulativeCadenceRevolutionCount: number;
	CalculatedCadence: number;
}

class CadenceScanState extends CadenceSensorState {
	Rssi: number;
	Threshold: number;
}

export class CadenceSensor extends Ant.AntPlusSensor {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x7A;

	public attach(channel, deviceID): void {
		console.log("deviceID: ", deviceID, ", SpeedCadenceSensor.deviceType: ", CadenceSensor.deviceType);
		super.attach(channel, 'receive', deviceID, CadenceSensor.deviceType, 0, 255, 8118/*8086*/);
		this.state = new CadenceSensorState(deviceID);
	}

	private state: CadenceSensorState;

	decodeData(data: Buffer) {
		//console.log("decodeData");
		if (data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM) !== this.channel) {
			console.log("bad channel");
			return;
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				if (this.deviceID === 0) {
					this.write(Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID));
				}

				updateState(this, this.state, data);
				break;
			case Constants.MESSAGE_CHANNEL_ID:
				this.deviceID = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
				this.transmissionType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				this.state.DeviceID = this.deviceID;
				break;
			default:
				break;
		}
	}

}

export class CadenceScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x7A;

	public scan() {
		super.scan('receive');
	}

	private states: { [id: number]: CadenceScanState } = {};

	decodeData(data: Buffer) {
		if (data.length <= (Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3) || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== CadenceScanner.deviceType) {
			console.log("Bad device");
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new CadenceScanState(deviceId);
		}

		if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
			if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
				this.states[deviceId].Rssi = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6);
				this.states[deviceId].Threshold = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7);
			}
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				updateState(this, this.states[deviceId], data);
				break;
			default:
				break;
		}
	}
}

function updateState(
	sensor: CadenceSensor | CadenceScanner,
	state: CadenceSensorState | CadenceScanState,
	data: Buffer) {
//	console.log("updateState");

	//get old state for calculating cumulative values
	const oldCadenceTime = state.CadenceEventTime;
	const oldCadenceCount = state.CumulativeCadenceRevolutionCount;

	let cadenceTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
	const cadenceCount = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
	console.log("cadenceTime: ", cadenceTime, ", cadenceCount: ", cadenceCount);

	if (true || cadenceTime !== oldCadenceTime) {
		state.CadenceEventTime = cadenceTime;
		state.CumulativeCadenceRevolutionCount = cadenceCount;
		if (oldCadenceTime > cadenceTime) { //Hit rollover value
			cadenceTime += (1024 * 64);
		}

		const cadence = ((60 * (cadenceCount - oldCadenceCount) * 1024) / (cadenceTime - oldCadenceTime));
		if (isNaN(cadence)) {
			state.CalculatedCadence = 0;
		} else {
			state.CalculatedCadence = cadence;
		}
		sensor.emit('cadenceData', state);
	}
}

