var Ant = require('./build/ant');
var HRS = require('./build/heart-rate-sensors');
var SSD = require('./build/stride-speed-distance-sensors');
var SC = require('./build/speed-cadence-sensors');
var C = require('./build/cadence-sensors');
var S = require('./build/speed-sensors');
var BP = require('./build/bicycle-power-sensors');
var FE = require('./build/fitness-equipment-sensors');

module.exports = {
	GarminStick2: Ant.GarminStick2,
	GarminStick3: Ant.GarminStick3,
	HeartRateSensor: HRS.HeartRateSensor,
	HeartRateScanner: HRS.HeartRateScanner,
	StrideSpeedDistanceSensor: SSD.StrideSpeedDistanceSensor,
	StrideSpeedDistanceScanner: SSD.StrideSpeedDistanceScanner,
	CadenceSensor: C.CadenceSensor,
	CadenceScanner: C.CadenceScanner,
	SpeedSensor: S.SpeedSensor,
	SpeedScanner: S.SpeedScanner,
	SpeedCadenceSensor: SC.SpeedCadenceSensor,
	SpeedCadenceScanner: SC.SpeedCadenceScanner,
	BicyclePowerSensor: BP.BicyclePowerSensor,
	BicyclePowerScanner: BP.BicyclePowerScanner,
	FitnessEquipmentSensor: FE.FitnessEquipmentSensor,
	FitnessEquipmentScanner: FE.FitnessEquipmentScanner
};
