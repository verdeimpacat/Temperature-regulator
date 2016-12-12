var triac;
var htu;
var temp;
var averageTemp;
var humidity;
var compHumidity;
var targetTemp;
var tempHistory = Float32Array(60); 
function onInit () {
   I2C2.setup( {scl: B10, sda: B3, bitrate: 19200 } );
   htu = require('HTU21D').connect( I2C2 );
   // Before anything else we should turn off the triac
   triac=A8;
   digitalWrite(triac,0); //this shoud reset the pin and set it as output
   temp = (htu.readTemperature()+htu.readTemperature()+htu.readTemperature())/3;
   //at power-on we assume the temperature was constant for the entire measurement history
   tempHistory.fill(temp);
   averageTemp = temp;
   //turn HTU21D heater on for two seconds just to make sure the HTU21D sensor
   //has no condensation
   htu.setHeaterOn( true );
   setTimeout('htu.setHeaterOn(false);', 2000);
   targetTemp = 16.00;
}
       
function pidControlLoop() {
   temp = (htu.readTemperature()+htu.readTemperature()+htu.readTemperature())/3;
   humidity = htu.readHumidity();
   compHumdity = htu.getCompensatedHumidity( humidity, temp );
   var regulatedTemp = targetTemp;
   //we want to check that moving towards regulated temp does not produce 
   //condensation. Furthermore, if the current temp is close or bellow
   //dew point we wish to move to slightly higher temp
   var dewPointTemp=htu.getDewPoint(temp,compHumdity);
   if (((targetTemp-dewPointTemp) < 1) || ((temp - dewPointTemp) < 1)) {
      regulatedTemp=dewPointTemp + 1;
   }
   //same, we want to check that the oldest temperature measured was above the dew point temperature
   //this is needed to avoid condensation due to thermal inertia for glass or metal objects
   //we better move slowly to higher temperature if such.
   if ((tempHistory[59] - dewPointTemp) < 1) {
      regulatedTemp = tempHistory[59] + 1;
   }
   // here we apply the proportional-integrative-derivative control with some  
   // adapted coefficients for the speciffic application.
   var PIDresult =0.5 * (regulatedTemp-temp + 3 * (regulatedTemp-averageTemp) + 10 * (tempHistory[0]-temp));
   calculatedPWM  = E.clip (PIDresult, 0, 1);
   analogWrite(triac, calculatedPWM, { freq : 0.2 });
   //Prepare for the next loop
   averageTemp = averageTemp - (tempHistory[59] - temp)/60;
   for (i=59;i>0;i--) {
      tempHistory[i] = tempHistory[i-1];
   }
   tempHistory[0] = temp;
   console.log("Temperature = " + tempHistory[0].toFixed(2) + " °C" +"   Humidity    = " + humidity.toFixed(2) + " %" );
   console.log("Dew point   = " + dewPointTemp.toFixed(2) + " °C" + "   Reg.Temp = " + regulatedTemp.toFixed(2) + " °C");
   console.log("PIDresult   = " + PIDresult.toFixed(2) + "   PWM   = " + calculatedPWM.toFixed(2));  
   console.log("Avrg Temp   = " + averageTemp.toFixed(2));
}
//power on initialization
onInit();
// hereby we set the control loop to 60 seconds
setInterval('pidControlLoop()',60000);

