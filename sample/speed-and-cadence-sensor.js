'use strict';

const Ant = require('../ant-plus');
const stick = new Ant.GarminStick2();
const cadenceSensor = new Ant.CadenceSensor(stick);
const speedSensor = new Ant.SpeedSensor(stick);
speedSensor.setWheelCircumference(2.120); //Wheel circumference in meters

speedSensor.on('speedData', data => {
  console.log(`speed: ${data.CalculatedSpeed}`);
});

cadenceSensor.on('cadenceData', data => {
  console.log(`cadence: ${data.CalculatedCadence}`);
});


stick.on('startup', function () {
	console.log('startup');
	speedSensor.attach(0, 0);
	cadenceSensor.attach(0, 0);
});

if (!stick.open()) {
	console.log('Stick not found!');
}
