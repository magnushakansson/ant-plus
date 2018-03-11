/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class SpeedSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	SpeedEventTime: number;
	CumulativeSpeedRevolutionCount: number;
	CalculatedDistance: number;
	CalculatedSpeed: number;
}

class SpeedScanState extends SpeedSensorState {
	Rssi: number;
	Threshold: number;
}

export class SpeedSensor extends Ant.AntPlusSensor {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x7B;

	wheelCircumference: number = 2.118; //This is my 700c wheel, just using as default

	setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}


	public attach(channel, deviceID): void {
		console.log("deviceID: ", deviceID, ", SpeedSensor.deviceType: ", SpeedSensor.deviceType);
		super.attach(channel, 'receive', deviceID, SpeedSensor.deviceType, 0, 255, 8118);
		this.state = new SpeedSensorState(deviceID);
	}

	private state: SpeedSensorState;

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

export class SpeedScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x7B;

	wheelCircumference: number = 2.118; //This is my 700c wheel, just using as default

	setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}

	public scan() {
		super.scan('receive');
	}

	private states: { [id: number]: SpeedScanState } = {};

	decodeData(data: Buffer) {
		if (data.length <= (Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3) || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== SpeedScanner.deviceType) {
			console.log("Bad device");
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new SpeedScanState(deviceId);
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
	sensor: SpeedSensor | SpeedScanner,
	state: SpeedSensorState | SpeedScanState,
	data: Buffer) {
//	console.log("updateState");

	//get old state for calculating cumulative values
	const oldSpeedTime = state.SpeedEventTime;
	const oldSpeedCount = state.CumulativeSpeedRevolutionCount;

	let speedEventTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
	const speedRevolutionCount = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);

	if (speedEventTime !== oldSpeedTime) {
		state.SpeedEventTime = speedEventTime;
		state.CumulativeSpeedRevolutionCount = speedRevolutionCount;
		if (oldSpeedTime > speedEventTime) { //Hit rollover value
			speedEventTime += (1024 * 64);
		}

		const distance = sensor.wheelCircumference * (speedRevolutionCount - oldSpeedCount);
		state.CalculatedDistance = distance;

		//speed in m/sec
		const speed = (distance * 1024) / (speedEventTime - oldSpeedTime);
		if (!isNaN(speed)) {
			state.CalculatedSpeed = speed;
			sensor.emit('speedData', state);
		}
	}
}

