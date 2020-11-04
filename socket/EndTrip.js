const Pending = require("../models/Pending");
const DriverM = require("../models/Driver");

var {users} = require("../server");
const axios = require("axios");

module.exports = async function (data, socket, io) {
    try {
        const config = {
          method: "post",
          url: `https://devmachine.taketosa.com/api/Trip/FinishTrip?tripId=${data.tripID}&lat=${data.lat}&lng=${data.lng}&amount=${data.amount}`,
          headers: {
            "Content-Type": "application / json",
            Authorization: "Bearer " + data.token,
            "Accept-Language": data.Language,
          },
        };
        console.log(data)
       await axios(config).then(async resp=>{
          console.log(resp.data)
          if(resp.data.status){
            console.log(resp.data)
  
        await Pending.findOne({tripID: data.tripID})
          .then((trip) => {
            io.to(users.get(trip.userID)).emit("EndTrip", {
              tripID: data.tripID,
              status: true,
            });
            socket.emit("EndTrip", {status: true,message:"success"});
          })
          .then(async (re) => {
            console.log(re,"kldjsklj")
            await DriverM.updateOne(
              {
                driverID: data.driverID,
              },
              {
                $set: {
                  isBusy: false,
                },
              }
            );
          });
          }
        else{ 
          socket.emit("EndTrip", {status: false, message: "error in sql"});
        }
       })
      } catch {
        socket.emit("EndTrip", {status: false, message: "error in mongodb"});
      }
};
