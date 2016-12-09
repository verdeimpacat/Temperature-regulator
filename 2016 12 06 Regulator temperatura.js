var triac;
I2C2.setup( {scl: B10, sda: B3, bitrate: 19200 } );
console.log("i am alive 0"); 
var htu = require('HTU21D').connect( I2C2 );
console.log("i am alive 1"); 
var temp;
var averageTemp;
var humidity;
var compHumidity; // improved accuracy for humidity
var targetTemp;
// for the finetuning of the regulation we will keep in TempHistory the  
// historical values of the last hour
var tempHistory = Float32Array(60); 
console.log("i am alive 2"); 
function onInit () {
   // Before anything else we should turn off the triac
   triac=A8;
   digitalWrite(triac,0); //this shoud reset the pin and set it as output
   temp = htu.readTemperature();
   console.log("i am alive 3"); 
   //at power-on we assume the temperature was constant for the last hour
   tempHistory.fill(temp);
   averageTemp = temp;
   //turn HTU21D heater on for two seconds just to make sure the HTU21D sensor
   //has no condensation
   htu.setHeaterOn( true );
   console.log("i am alive 4"); 
   setTimeout('htu.setHeaterOn(false);', 2000);
   console.log("i am alive 5"); 
   targetTemp = 16.00;
}
       
function pidControlLoop() {
   temp = htu.readTemperature();
   humidity = htu.readHumidity();
   compHumdity = htu.getCompensatedHumidity( humidity, temp );
   var regulatedTemp = targetTemp;
   //we want to check that moving towards regulated temp does not produce 
   //condensation. Furthermore, if the current temp is close or bellow
   //dew point we wish to move to higher temp
   var dewPointTemp=htu.getDewPoint(temp,compHumdity);
   if (((targetTemp-dewPointTemp) < 1) || ((temp - dewPointTemp) < 1)) {
      regulatedTemp=dewPointTemp + 1;
   }
   //same, we want to check that the temperature one hour ago was above
   //the dew point temperature
   //this is because the metal and glass of the photo lenses has thermal  
   //inertia and we don't want condensation to occur on these. We better
   //move slowly to higher temperature if such.
   if ((tempHistory[59] - dewPointTemp) < 1) {
      regulatedTemp = tempHistory[59] + 1;
   }
   // here we apply the proportional-integrative-derivative control with some  
   // coefficients we feel appropriate. We will make some temperature regulation 
   // graphs to finetune these coefficients once the system is running
   var PIDresult =0.5 * (regulatedTemp-temp + 3 * (regulatedTemp-averageTemp) + 10 * (tempHistory[0]-temp));
   //for summer days we should imagine vent./AC control if PIDresult is < zero...
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

