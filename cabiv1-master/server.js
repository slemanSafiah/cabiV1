const express = require("express");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const http = require("http");
const cors = require("cors");
var serviceAccount = require("./cabi-app-firebase-adminsdk-4cy4f-c6feddd07b.json");

const DriverM = require("./models/Driver");
const socketIo = require("socket.io");
const Pending = require("./models/Pending");
require("dotenv/config");

const app = express();
app.use(cors());
app.use(express.json());

var users = new Map();
var admins = new Map();
var userinterval = new Map();
var listinterval = new Map();
var trackinterval = new Map();

module.exports.google_Key = "AIzaSyBS7IT1kU9vqhmespj2UB32HDkez6v41y4";
module.exports.entitle = "Congratulation, you get a new trip";
module.exports.artitle = " تهانينا، لقد حصلت على طلب توصيل زبون";
module.exports.enmes =
  "Congratulation, you get a new trip, please accept it quickly";
module.exports.armes =
  " تهانينا، لقد حصلت على طلب توصيل زبون ، فضلا اقبل الطلب سريع";
module.exports.nodrivertitleen = "Sorry, No Captains available now!";
module.exports.nodrivertitlear = " !عفوا ، لايتوفر كباتن متاحة حاليا";
module.exports.nodrivermesen =
  "Sorry, No Captains available now, please try again!";
module.exports.nodrivermesar =
  "!عفوا ، لايتوفر كباتن متاحة حاليا، فضلا حاول مرة أخرى";
module.exports.users = users;
module.exports.admins = admins;
module.exports.userinterval = userinterval;
module.exports.listinterval = listinterval;
module.exports.trackinterval = trackinterval;
module.exports.notification_options = {
  priority: "high",
  timeToLive: 60 * 60 * 24,
};

mongoose.connect(
  process.env.DB_CONNECTION,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  () => console.log("connected to DB")
);

mongoose.connection.on("error", (err) => {
  console.log("error from server");
});

var AcceptRejectTrip = require("./socket/AcceptRejectTrip");
var AdminGetCount = require("./socket/AdminGetCount");
var AdminGetDrivers = require("./socket/AdminGetDrivers");
var CancelTripByClient = require("./socket/CancelTripByClient");
var CancelTripByDriver = require("./socket/CancelTripByDriver");
var ChangeTripStatus = require("./socket/ChangeTripStatus");
var GetAvailableDrivers = require("./socket/GetAvailableDrivers");
var GetAvailableTripCategoryCar = require("./socket/GetAvailableTripCategoryCar");
var IsBusy = require("./socket/IsBusy");
var IsOnline = require("./socket/IsOnline");
var NewTripRequest = require("./socket/NewTripRequest");
var UpdateLocation = require("./socket/Updatelocation");
const {models} = require("mongoose");

const server = http.createServer(app);
const io = socketIo(server);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cabi-app.firebaseio.com",
});

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("IsBusy", async (data) => {
    IsBusy(data, socket, io);
  });

  socket.on("IsOnline", async (data) => {
    IsOnline(data, socket, io);
  });

  socket.on("NewTripRequest", async (data) => {
    NewTripRequest(data, socket, io);
  });

  socket.on("AcceptRejectTrip", async (data) => {
    AcceptRejectTrip(data, socket, io);
  });

  socket.on("CancelTripByDriver", async (data) => {
    CancelTripByDriver(data, socket, io);
  });

  socket.on("CancelTripByClient", async (data) => {
    CancelTripByClient(data, socket, io);
  });

  socket.on("ChangeTripStatus", async (data) => {
    ChangeTripStatus(data, socket, io);
  });

  socket.on("Finish", async (data) => {
    try {
      await Pending.findOne({tripID: data.tripID})
        .then((trip) => {
          io.to(users.get(trip.userID)).emit("Finish", {
            tripID: data.tripID,
            status: true,
          });
          socket.emit("Finish", {status: true});
        })
        .then(async (re) => {
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
    } catch {
      socket.emit("Finish", {status: false, message: "error in mongodb"});
    }
  });

  socket.on("UpdateLocation", (data) => {
    UpdateLocation(data, socket, io);
  });

  socket.on("GetAvailableDrivers", (data) => {
    GetAvailableDrivers(data, socket, io);
  });

  socket.on("GetAvailableTripCategoryCar", async (data) => {
    GetAvailableTripCategoryCar(data, socket, io);
  });

  socket.on("AdminGetDrivers", (data) => {
    AdminGetDrivers(data, socket, io);
  });

  socket.on("AdminGetCount", (data) => {
    AdminGetCount(data, socket, io);
  });

  socket.on("join", (id) => {
    users.set(id, socket.id);
    console.log(users);
  });

  socket.on("joinAdmin", (id) => {
    admins.set(id, socket.id);
    console.log(admins);
  });

  socket.on("disconnect", async (id) => {
    try {
      const getKey = await function w() {
        return [...users].find(([key, val]) => val == socket.id)[0];
      };
      const driver = getKey();
      console.log(driver);
      try {
        const updated_driver = await DriverM.updateOne(
          {
            driverID: driver,
          },
          {
            $set: {
              isOnline: false,
            },
          }
        ).then((dr) => {
          admins.forEach((admin) => {
            io.to(admin).emit("trackCount");
          });
        });
      } catch {}
      // console.log(getKey(socket.id), "lk;lk");
      users.delete(driver);
      listinterval.delete(driver);
      userinterval.delete(driver);
      trackinterval.delete(driver);
      console.log("user disconnected", socket.id, users);
    } catch {}
  });

  socket.on("disconnectAdmin", (number) => {
    admins.delete(number);
    console.log("admin disconnected");
  });
});

app.post("/driver/updateLocation", async (req, res) => {
  console.log(req.query);
  var newLat = req.query.lat;
  var newLong = req.query.lng;
  try {
    DriverM.findOne({
      driverID: req.query.driverID,
    })
      .then((driver) =>
        DriverM.updateOne(
          {
            driverID: req.query.driverID,
          },
          {
            $set: {
              oldLocation: {
                coordinates: [
                  driver.location.coordinates[1],
                  driver.location.coordinates[0],
                ],
                type: "Point",
              },
              location: {
                coordinates: [newLong, newLat],
                type: "Point",
              },
              UpdateLocationDate: new Date(),
            },
          }
        ).then(() => {
          const location = {
            coordinates: [newLong, newLat],
            type: "Point",
          };
          const data = {
            status:
              driver.isOnline === true && driver.isBusy == false
                ? 1
                : driver.isOnline == true && driver.isBusy == true
                ? 2
                : driver.isOnline == false
                ? 3
                : 0,
            driverID: driver.driverID,
            location: location,
            categoryCarTypeID: driver.categoryCarTypeID,
            phoneNumber: driver.phoneNumber,
            idNo: driver.idNo,
            driverNameAr: driver.driverNameAr,
            driverNameEn: driver.driverNameEn,
            modelNameAr: driver.modelNameAr,
            modelNameEn: driver.modelNameEn,
            colorNameAr: driver.colorNameAr,
            colorNameEn: driver.colorNameEn,
            carImage: driver.carImage,
            driverImage: driver.driverImage,
            updateLocationDate: driver.updateLocationDate,
            trip: driver.isBusy ? driver.busyTrip : "",
          };
          console.log(data);
          admins.forEach((admin) => {
            io.to(admin).emit("trackAdmin", data);
          });

          res.json({
            sucess: 1,
            message: "update location success",
          });
        })
      )
      .catch((err) => console.log(err));
  } catch (error) {
    console.log("error");
    res.json({
      sucess: 0,
      message: "update busy status faild",
    });
  }
});

const Port = process.env.Port || 5000;
server.listen(Port, () => {
  console.log(`Server running on port ${Port}`);
});
