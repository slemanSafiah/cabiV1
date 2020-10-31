const express = require("express");
const mongoose = require("mongoose");
const socketIo = require("socket.io");
const admin = require("firebase-admin");
const http = require("http");
const cors = require("cors");
const DriverM = require("./models/Driver");
const Pending = require("./models/Pending");
var serviceAccount = require("./cabi-app-firebase-adminsdk-4cy4f-c6feddd07b.json");

require("dotenv/config");

const app = express();
app.use(cors());
app.use(express.json());
const logger = require("./logger");

var users = new Map();
var admins = new Map();
var userinterval = new Map();
var listinterval = new Map();
var trackinterval = new Map();

exports.users = users;
exports.admins = admins;
exports.userinterval = userinterval;
exports.listinterval = listinterval;
exports.trackinterval = trackinterval;


const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect(process.env.DB_CONNECTION, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}, () => console.log("connected to DB")
);

mongoose.connection.on("error", (err) => {
  console.log("error from server");
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cabi-app.firebaseio.com",
});

exports.notification_options = { priority: "high", timeToLive: 60 * 60 * 24 };
exports.entitle = "Congratulation, you get a new trip";
exports.artitle = " تهانينا، لقد حصلت على طلب توصيل زبون";
exports.enmes = "Congratulation, you get a new trip, please accept it quickly";
exports.armes = " تهانينا، لقد حصلت على طلب توصيل زبون ، فضلا اقبل الطلب سريع";
exports.nodrivertitleen = "Sorry, No Captains available now!";
exports.nodrivertitlear = " !عفوا ، لايتوفر كباتن متاحة حاليا";
exports.nodrivermesen = "Sorry, No Captains available now, please try again!";
exports.nodrivermesar = "!عفوا ، لايتوفر كباتن متاحة حاليا، فضلا حاول مرة أخرى";
exports.io = io;
exports.admin = admin;

var is_Online = require('./socket/is_Online');
var newTrip = require('./socket/newTrip');
var driverRespond = require('./socket/driverRespond');
var CancelOnWay = require('./socket/CancelOnWay');
var cancelPassenger = require('./socket/cancelPassenger');
var arrive = require('./socket/arrive');
var updatelocation = require('./socket/updatelocation');
var getavailable = require('./socket/getavailable');
var listCategory = require('./socket/listCategory');
var trackCategory = require('./socket/trackCategory');
var AdminGetDrivers = require('./socket/AdminGetDrivers');
var AdminGetCount = require('./socket/AdminGetCount');

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("is_Online", (data) => {
    is_Online(data);
  });

  socket.on("newTrip", async (data) => {
    socket.setMaxListeners(21);
    newTrip(data);
  });

  socket.on("driverRespond", async (data) => {
    driverRespond(data);
  });

  socket.on("CancelOnWay", async (data) => {
    CancelOnWay(data);
  });

  socket.on("cancelPassenger", async (data) => {
    cancelPassenger(data);
  });

  socket.on("arrive", async (data) => {
    arrive(data);
  });

  socket.on("finish", (data) => {
    Pending.findOne({ tripID: data.tripID }).then((trip) => {
      socket.to(users.get(trip.userID)).emit("finish", data.tripID);
    });
  });

  socket.on("updatelocation", (data) => {
    updatelocation(data);
  });

  socket.on("getavailable", (data) => {
    getavailable(data);
  });

  socket.on("listCategory", async (data) => {
    listCategory(data);
  });

  socket.on("trackCategory", async (data) => {
    trackCategory(data);
  });

  socket.on("AdminGetDrivers", (data) => {
    AdminGetDrivers(data);
  });

  socket.on("AdminGetCount", (data) => {
    AdminGetCount(data);
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
      } catch { }
      // console.log(getKey(socket.id), "lk;lk");
      users.delete(driver);
      listinterval.delete(driver);
      userinterval.delete(driver);
      trackinterval.delete(driver);
      console.log("user disconnected", socket.id, users);
    } catch { }
  });

  socket.on("disconnectAdmin", (number) => {
    admins.delete(number);
    console.log("admin disconnected");
  });
});

app.post("/driver/is_Busy", async (req, res) => {
  console.log(req.query);
  try {
    const driver = await DriverM.findOne({
      driverID: req.query.driverID,
    });
    if (req.query.status == 1) {
      const updated_driver = await DriverM.updateOne(
        {
          driverID: req.query.driverID,
        },
        {
          $set: {
            isBusy: true,
          },
        }
      ).then(() => {
        const ISBUSY = true;
        const data = {
          status:
            driver.isOnline === true && ISBUSY == false
              ? 1
              : driver.isOnline == true && ISBUSY == true
                ? 2
                : driver.isOnline == false
                  ? 3
                  : 0,
          driverID: driver.driverID,
          location: driver.location,
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
        admins.forEach((admin) => {
          io.to(admin).emit("trackAdmin", data);
          io.to(admin).emit("trackCount");
        });
      });
    }
    if (req.query.status == 2) {
      const updated_driver = await DriverM.updateOne(
        {
          driverID: req.query.driverID,
        },
        {
          $set: {
            isBusy: false,
            busyTrip: {},
          },
        }
      ).then(() => {
        const ISBUSY = false;
        const data = {
          status:
            driver.isOnline === true && ISBUSY == false
              ? 1
              : driver.isOnline == true && ISBUSY == true
                ? 2
                : driver.isOnline == false
                  ? 3
                  : 0,
          driverID: driver.driverID,
          location: driver.location,
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
        admins.forEach((admin) => {
          io.to(admin).emit("trackAdmin", data);
          io.to(admin).emit("trackCount");
        });
      });
    }
    res.json({
      sucess: 1,
      message: "update busy status success",
    });
  } catch (error) {
    res.json({
      sucess: 0,
      message: error,
    });
  }
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
  logger.log("error", `Server running on port ${Port}`);
});
