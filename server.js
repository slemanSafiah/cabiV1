const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");

const DriverM = require("./models/Driver");
const CategoryFareM = require("./models/CategoryFare");
const DeliverySettingM = require("./models/DeliverySetting");
const TripM = require("./models/Trip");
const socketIo = require("socket.io");
const http = require("http");
const admin = require("firebase-admin");
var serviceAccount = require("./cabi-app-firebase-adminsdk-4cy4f-c6feddd07b.json");
const { listIndexes } = require("./models/Driver");
const { v4: uuidv4 } = require("uuid");
const Pending = require("./models/Pending");
const Driver = require("./models/Driver");

require("dotenv/config");

var google_Key = "AIzaSyCKW4oeH-_tRtLAT_sWK9G7wbgEOpxWAzI";

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

mongoose.connect(process.env.DB_CONNECTION, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}, () => console.log("connected to DB")
);

mongoose.connection.on("error", (err) => {
  console.log("error from server");
});

const server = http.createServer(app);
const io = socketIo(server);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cabi-app.firebaseio.com",
});

const notification_options = {
  priority: "high",
  timeToLive: 60 * 60 * 24,
};
exports.notification_options = {
  priority: "high",
  timeToLive: 60 * 60 * 24,
};
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
    try {
      console.log(data);
      await Driver.findOne({ driverID: data.driverID }).then(async (driver) => {
        await Pending.findOne({ tripID: data.tripID }).then((trip) => {
          console.log(users.get(trip.userID), trip.userID);
          socket
            .to(users.get(trip.userID))
            .emit("arrive", { tripID: data.tripID, status: true });
          socket
            .to(users.get(data.driverID))
            .emit("arrive", { tripID: data.tripID, status: true });

          var postData;

          if (trip.deviceType == 1) {
            // IOS
            postData = {
              data: {
                PushType: "6",
                PushTitle:
                  trip.Language == "ar"
                    ? "الكابتن وصل إليك "
                    : "Your Captain has arrived",
              },
              notification: {
                body:
                  trip.Language == "ar"
                    ? `الكابتن ${driver.driverNameAr} وصل إليك بمركبة ${driver.modelNameAr} ، رقم لوحة ${driver.plateNumber}`
                    : `Captain ${driver.driverNameEn} has arrived in a ${driver.modelNameEn} plate number ${driver.plateNumber}`,
                sound: "default",
              },
            };
          } else if (trip.deviceType == 2) {
            // Andriod
            postData = {
              data: {
                PushType: "6",
                PushTitle:
                  trip.Language == "ar"
                    ? "الكابتن وصل إليك "
                    : "Your Captain has arrived",
                PushMessage:
                  trip.Language == "ar"
                    ? `الكابتن ${driver.driverNameAr} وصل إليك بمركبة ${driver.modelNameAr} ، رقم لوحة ${driver.plateNumber}`
                    : `Captain ${driver.driverNameEn} has arrived in a ${driver.modelNameEn} plate number ${driver.plateNumber}`,
                content_available: "true",
                priority: "high",
              },
            };
          }

          admin.messaging().sendToDevice(
            trip.tokenID,
            postData,

            notification_options
          );
        });
      });
    } catch { }
  });

  socket.on("finish", (data) => {
    Pending.findOne({ tripID: data.tripID }).then((trip) => {
      socket.to(users.get(trip.userID)).emit("finish", data.tripID);
    });
  });

  socket.on("updatelocation", (data) => {
    //console.log(data);
    var newLat = data.lat;
    var newLong = data.long;
    try {
      DriverM.findOne({
        driverID: data.driverID,
      })
        .then((driver) =>
          DriverM.updateOne(
            {
              driverID: data.driverID,
            },
            {
              $set: {
                oldLocation: {
                  coordinates: [
                    driver.location.coordinates[0],
                    driver.location.coordinates[1],
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
            // console.log(data);
            admins.forEach((admin) => {
              io.to(admin).emit("trackAdmin", data);
            });
          })
        )
        .catch((err) => console.log(err));
    } catch (error) {
      console.log("error");
    }
  });

  socket.on("getavailable", (data) => {
    //console.log(data);
    const id = uuidv4();
    userinterval.set(data.userid, id);
    try {
      DriverM.find({
        isBusy: false,
        isOnline: true,
        isDeleted: false,
        genderRequest: data.genderRequest,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [data.long, data.lat],
            },
            //   $maxDistance: 5000,
          },
        },
      }).then(async (res) => {
        //console.log(res,"eeeeeeee");
        var near = res[0];
        if (near) {
          const time = await DistinationDuration(
            near.location.coordinates[1],
            near.location.coordinates[0],
            data.long,
            data.lat
          );
          var driversList = [];
          res.map((driver) => {
            const temp = {
              lat: driver.location.coordinates[1],
              lng: driver.location.coordinates[0],
              driverID: driver.driverID,
              oldLat: driver.oldLocation.coordinates[1],
              oldLng: driver.oldLocation.coordinates[0],
            };
            if (driversList.length < 5) driversList.push(temp);
          });
          const data1 = {
            drivers: driversList,
            time:
              time[0].duration == undefined
                ? -1
                : (time[0].duration.value / 60).toFixed(),
            status: time[0].duration == undefined ? false : true,
            msg: time[0].duration == undefined ? "error google api" : "",
          };
          //console.log(data1);
          let user_id = users.get(data.userid);
          // console.log(user_id);
          io.to(user_id).emit("getavailable", data1);
        } else {
          const data1 = {
            drivers: [],
            time: -1,
            status: false,
            msg: "no driver available",
          };
          let user_id = users.get(data.userid);
          // console.log(user_id);
          io.to(user_id).emit("getavailable", data1);
        }
      });
      const fun = () => {
        if (
          users.get(data.userid) == undefined ||
          userinterval.get(data.userid) != id
        ) {
          clearInterval(interval);
          //console.log("kkkkkkkkk");
        }
        DriverM.find({
          isBusy: false,
          isOnline: true,
          isDeleted: false,
          genderRequest: data.genderRequest,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [data.long, data.lat],
              },
              //   $maxDistance: 5000,
            },
          },
        }).then(async (res) => {
          var near = res[0];
          //console.log(near);
          if (near) {
            const time = await DistinationDuration(
              near.location.coordinates[1],
              near.location.coordinates[0],
              data.long,
              data.lat
            );
            var driversList = [];
            res.map((driver) => {
              const temp = {
                lat: driver.location.coordinates[1],
                lng: driver.location.coordinates[0],
                driverID: driver.driverID,
                oldLat: driver.oldLocation.coordinates[1],
                oldLng: driver.oldLocation.coordinates[0],
              };
              if (driversList.length < 5) driversList.push(temp);
            });
            const data1 = {
              drivers: driversList,
              time:
                time[0].duration == undefined
                  ? -1
                  : (time[0].duration.value / 60).toFixed(),
              status: time[0].duration == undefined ? false : true,
              msg: time[0].duration == undefined ? "error google api" : "",
            };
            if (
              users.get(data.userid) != undefined &&
              userinterval.get(data.userid) == id
            ) {
              let user_id = users.get(data.userid);
              //console.log(user_id);

              io.to(user_id).emit("getavailable", data1);
            }
          } else {
            const data1 = {
              drivers: [],
              time: -1,
              status: false,
              msg: "no driver available",
            };
            if (
              users.get(data.userid) != undefined &&
              userinterval.get(data.userid) == id
            ) {
              let user_id = users.get(data.userid);
              // console.log(user_id);

              io.to(user_id).emit("getavailable", data1);
            }
          }
          //console.log(data1.time)
        });
      };
      var interval = setInterval(fun, 20000);
    } catch (err) {
      console.log(err);
      let user_id = users.get(data.userid);
      // console.log(user_id);
      io.to(user_id).emit("getavailable", {
        status: false,
        msg: "location out of bounds",
      });
    }
  });

  socket.on("listCategory", async (data) => {
    const id = uuidv4();
    listinterval.set(data.userId, id);
    // console.log(data);
    var discountType = -1;
    var discountValue = 0;

    const config = {
      method: "post",
      url: `http://devmachine.taketosa.com/api/Trip/CheckPromoCode?promoCode=${data.promoCode}`,
      headers: {
        "Content-Type": "application / json",
        Authorization: "Bearer " + data.token,
        "Accept-Language": data.Language,
      },
    };
    if (data.promoCode != "") {
      let promoResponse = await axios(config).then((res) => {
        console.log(res.data);
        if ((!res.data.status || !res.data.data.isValid) && data.promoCode) {
          var user_id = users.get(data.userId);
          discountValue = -1;
          //console.log(user_id);
          io.to(user_id).emit("promoCode", {
            message: res.data.message,
            status: false,
          });
        } else if (res.data.data.isValid) {
          discountType = res.data.data.discountType;
          discountValue = res.data.data.discountValue;
          var user_id = users.get(data.userId);
          io.to(user_id).emit("promoCode", {
            status: true,
          });
        }
      });
    }
    //console.log(discountType, discountValue);
    if (discountValue != -1) {
      try {
        const time = await DistinationDuration(
          data.dropoffLat,
          data.dropoffLng,
          data.pickupLng,
          data.pickupLat
        ).then(async (time) => {
          const category = await CategoryFareM.find({}).then(async (res) => {
            //console.log("tttt", res);

            var responseArray = [];
            var mainCatTime = 0;
            for (var i = 1; i <= res.length; i++) {
              //console.log(i);
              const temp = await DriverM.findOne({
                isBusy: false,
                isOnline: true,
                isDeleted: false,
                genderRequest: data.genderRequest,
                location: {
                  $near: {
                    $geometry: {
                      type: "Point",
                      coordinates: [data.pickupLng, data.pickupLat],
                    },
                    //$maxDistance: 5000,
                  },
                },
                categoryCarTypeID: i,
              }).then(async (driver) => {
                if (i == 1 && driver == null) {
                  //console.log(i, driver);
                  let user_id = users.get(data.userid);
                  io.to(user_id).emit("getavailable", {
                    msg: "لا يوجد سائق متاح في منطقتك حالياً",
                  });
                } else if (driver != null) {
                  //console.log(driver);
                  const e = await DistinationDuration(
                    driver.location.coordinates[1],
                    driver.location.coordinates[0],
                    data.pickupLng,
                    data.pickupLat
                  ).then(async (driverTime) => {
                    // console.log("nm", i, driver.driverID);
                    const Cost = await tripCost(
                      data.pickupLng,
                      data.pickupLat,
                      data.dropoffLng,
                      data.dropoffLat,
                      driver.categoryCarTypeID,
                      discountType,
                      discountValue
                    ).then((cost) => {
                      // console.log("cost", i, cost);
                      responseArray.push({
                        Name:
                          data.Language == "ar"
                            ? res[i - 1].categoryCarNameAr
                            : res[i - 1].categoryCarNameEn,
                        Photo: res[i - 1].categoryImage,
                        Minutes: (driverTime[0].duration.value / 60).toFixed(),
                        dest: (driverTime[0].distance.value / 1000).toFixed(),
                        Cost: cost,
                        isMain: res[i - 1].isMain,
                        categoryCarTypeID: res[i - 1].categoryCarTypeID,
                      });
                      if (res[i - 1].isMain)
                        mainCatTime = (
                          driverTime[0].duration.value / 60
                        ).toFixed();
                    });
                    //console.log(driver.driverImage);
                  });
                }
              });
            }

            var driveTime = driveTimeCalc(
              parseInt(time[0].duration.value / 60),
              mainCatTime,
              data.Language
            );
            const data1 = {
              categories: responseArray,
              mainCatTime,
              driveTime,
              status: true,
            };
            //console.log(data1, users.get(data.userId), data.userId);
            var user_id = users.get(data.userId);
            io.to(user_id).emit("listCategory", data1);
          });
          const fun = () => {
            if (
              users.get(data.userId) == undefined ||
              listinterval.get(data.userId) != id
            ) {
              clearInterval(interval);
            }
            const category = CategoryFareM.find({}).then(async (res) => {
              //console.log("tttt", res);

              var responseArray = [];
              var mainCatTime = 0;
              for (var i = 1; i <= res.length; i++) {
                //console.log(i);
                const temp = await DriverM.findOne({
                  isBusy: false,
                  isOnline: true,
                  isDeleted: false,
                  genderRequest: data.genderRequest,
                  location: {
                    $near: {
                      $geometry: {
                        type: "Point",
                        coordinates: [data.pickupLng, data.pickupLat],
                      },
                      //$maxDistance: 5000,
                    },
                  },
                  categoryCarTypeID: i,
                }).then(async (driver) => {
                  if (i == 1 && driver == null) {
                    let user_id = users.get(data.userid);
                    io.to(user_id).emit("getavailable", {
                      msg: "no driver found",
                    });
                  } else if (driver != null) {
                    //  console.log(driver);
                    const e = await DistinationDuration(
                      driver.location.coordinates[1],
                      driver.location.coordinates[0],
                      data.pickupLng,
                      data.pickupLat
                    ).then(async (driverTime) => {
                      //  console.log("nm", i, driverTime);
                      const Cost = await tripCost(
                        data.pickupLng,
                        data.pickupLat,
                        data.dropoffLng,
                        data.dropoffLat,
                        driver.categoryCarTypeID,
                        discountType,
                        discountValue
                      ).then((cost) => {
                        //   console.log("cost", i, cost);
                        responseArray.push({
                          Name:
                            data.Language == "ar"
                              ? res[i - 1].categoryCarNameAr
                              : res[i - 1].categoryCarNameEn,
                          Photo: res[i - 1].categoryImage,
                          Minutes: (
                            driverTime[0].duration.value / 60
                          ).toFixed(),
                          dest: (driverTime[0].distance.value / 1000).toFixed(),
                          Cost: cost,
                          isMain: res[i - 1].isMain,
                          categoryCarTypeID: res[i - 1].categoryCarTypeID,
                        });
                        if (res[i - 1].isMain)
                          mainCatTime = (
                            driverTime[0].duration.value / 60
                          ).toFixed();
                      });
                    });
                  }
                });
              }

              var driveTime = driveTimeCalc(
                parseInt(time[0].duration.value / 60),
                mainCatTime,
                data.Language
              );
              const data1 = {
                categories: responseArray,
                mainCatTime,
                driveTime,
                status: true,
              };
              //  console.log(data1);
              //console.log(data.userId, users.get(data.userId));

              if (
                users.get(data.userId) != undefined &&
                listinterval.get(data.userId) == id
              ) {
                var user_id = users.get(data.userId);
                // console.log(data.userId, users.get(data.userId));
                io.to(user_id).emit("listCategory", data1);
              }
            });
          };
          var interval = setInterval(fun, 10000);
        });
      } catch {
        var user_id = users.get(data.userId);
        // console.log(data.userId, users.get(data.userId));
        io.to(user_id).emit("listCategory", {
          status: false,
          msg: "location out of bounds",
        });
      }
    }
  });

  socket.on("trackCategory", async (data) => {
    const id = uuidv4();
    //console.log(id);
    trackinterval.set(data.userid, id);
    var discountType = -1;
    var discountValue = 0;
    console.log(data);

    const config = {
      method: "post",
      url: `http://devmachine.taketosa.com/api/Trip/CheckPromoCode?promoCode=${data.promoCode}`,
      headers: {
        "Content-Type": "application / json",
        Authorization: "Bearer " + data.token,
        "Accept-Language": data.Language,
      },
    };
    if (data.promoCode != "") {
      let promoResponse = await axios(config).then((res) => {
        console.log(res.data);
        if ((!res.data.status || !res.data.data.isValid) && data.promoCode) {
          var user_id = users.get(data.userId);
          discountValue = -1;
          console.log(user_id);
          io.to(user_id).emit("promoCode", {
            message: res.data.message,
            status: false,
          });
        } else if (res.data.data.isValid) {
          discountType = res.data.data.discountType;
          discountValue = res.data.data.discountValue;
          io.to(user_id).emit("promoCode", {
            message: res.data.message,
            status: false,
          });
        }
      });
    }
    console.log(discountType, discountValue);
    if (discountValue != -1) {
      try {
        const time = await DistinationDuration(
          data.dropoffLat,
          data.dropoffLng,
          data.pickupLng,
          data.pickupLat
        ).then(async (time) => {
          const category = await CategoryFareM.findOne({
            categoryCarTypeID: data.carCategory,
          }).then(async (res) => {
            //console.log("tttt", res);
            const d = await DriverM.findOne({
              isBusy: false,
              isOnline: true,
              isDeleted: false,
              genderRequest: data.genderRequest,
              location: {
                $near: {
                  $geometry: {
                    type: "Point",
                    coordinates: [data.pickupLat, data.pickupLng],
                  },
                  //$maxDistance: 5000,
                },
              },
              categoryCarTypeID: data.carCategory,
            }).then(async (driver) => {
              if (driver == null) {
                let user_id = users.get(data.userid);
                io.to(user_id).emit("trackCategory", {
                  msg: "لا يوجد سائق متاح في منطقتك حالياً",
                });
              } else if (driver != null) {
                //  console.log(driver);
                const e = await DistinationDuration(
                  driver.location.coordinates[0],
                  driver.location.coordinates[1],
                  data.pickupLng,
                  data.pickupLat
                ).then(async (driverTime) => {
                  // console.log("nm", driverTime);
                  const Cost = await tripCost(
                    data.pickupLng,
                    data.pickupLat,
                    data.dropoffLng,
                    data.dropoffLat,
                    driver.categoryCarTypeID,
                    discountType,
                    discountValue
                  ).then((cost) => {
                    const temp = {
                      NameAR: driver.driverNameAr,
                      NameEn: driver.driverNameEn,
                      Photo: driver.driverImage,
                      Minutes: (driverTime[0].duration.value / 60).toFixed(),
                      dest: (driverTime[0].distance.value / 1000).toFixed(),
                      Cost: cost,
                    };
                    var driveTime = driveTimeCalc(
                      (time[0].duration.value / 60).toFixed(),
                      (driverTime[0].duration.value / 60).toFixed(),
                      data.Language
                    );

                    const data1 = {
                      categories: temp,
                      driveTime,
                    };
                    // console.log(data1);
                    var user_id = users.get(data.userId);
                    io.to(user_id).emit("trackCategory", data1);
                  });
                });
              }
            });
            const fun = () => {
              //console.log(id);
              if (
                users.get(data.userid) == undefined ||
                trackinterval.get(data.userid) != id
              ) {
                clearInterval(interval);
                //console.log("kkkkkkkkk");
              }
              DriverM.findOne({
                isBusy: false,
                isOnline: true,
                isDeleted: false,
                location: {
                  $near: {
                    $geometry: {
                      type: "Point",
                      coordinates: [data.pickupLat, data.pickupLng],
                    },
                    //$maxDistance: 5000,
                  },
                },
                categoryCarTypeID: data.carCategory,
              }).then(async (driver) => {
                if (driver == null) {
                  let user_id = users.get(data.userid);
                  io.to(user_id).emit("trackCategory", {
                    msg: "لا يوجد سائق متاح في منطقتك حالياً",
                  });
                } else if (driver != null) {
                  //  console.log(driver);
                  const e = await DistinationDuration(
                    driver.location.coordinates[0],
                    driver.location.coordinates[1],
                    data.pickupLng,
                    data.pickupLat
                  ).then(async (driverTime) => {
                    // console.log("nm", driverTime);
                    const Cost = await tripCost(
                      data.pickupLng,
                      data.pickupLat,
                      data.dropoffLng,
                      data.dropoffLat,
                      driver.categoryCarTypeID,
                      discountType,
                      discountValue
                    ).then((cost) => {
                      const temp = {
                        NameAR: driver.driverNameAr,
                        NameEn: driver.driverNameEn,
                        Photo: driver.driverImage,
                        Minutes: (driverTime[0].duration.value / 60).toFixed(),
                        dest: (driverTime[0].distance.value / 1000).toFixed(),
                        Cost: cost,
                      };
                      var driveTime = driveTimeCalc(
                        (time[0].duration.value / 60).toFixed(),
                        (driverTime[0].duration.value / 60).toFixed(),
                        data.Language
                      );
                      const data1 = {
                        categories: temp,
                        driveTime,
                      };
                      //console.log(data1);
                      if (
                        users.get(data.userid) != undefined &&
                        trackinterval.get(data.userid) == id
                      ) {
                        var user_id = users.get(data.userId);
                        io.to(user_id).emit("listCategory", data1);
                      }
                    });
                  });
                }
              });
            };
            var interval = setInterval(fun, 20000);
          });
        });
      } catch { }
    }
  });

  socket.on("AdminGetDrivers", (data) => {
    //console.log(data);
    try {
      if (data.lat == 0) {
        DriverM.find({
          isDeleted: false,
        }).then(async (res) => {
          var list = [];
          res.map((driver) => {
            const temp = {
              status:
                driver.isOnline === true && driver.isBusy == false
                  ? 1
                  : driver.isOnline == true && driver.isBusy == true
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
            list.push(temp);
          });
          // console.log(list);

          admins.forEach((admin) => {
            // console.log(admin);
            io.to(admin).emit("AdminGetDrivers", list);
          });
        });
      } else {
        DriverM.find({
          isDeleted: false,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [data.lng, data.lat],
              },
              $maxDistance: data.maxDistance,
            },
          },
        }).then(async (res) => {
          var list = [];
          res.map((driver) => {
            const temp = {
              status:
                driver.isOnline === true && driver.isBusy == false
                  ? 1
                  : driver.isOnline == true && driver.isBusy == true
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
            list.push(temp);
          });

          admins.forEach((admin) => {
            // console.log(admin);
            io.to(admin).emit("AdminGetDrivers", list);
          });
        });
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("AdminGetCount", (data) => {
    // console.log(data);
    try {
      if (data.lat === 0) {
        DriverM.find({
          isBusy: true,
        }).then(async (busy) => {
          DriverM.find({
            isOnline: true,
            isBusy: false,
          }).then(async (online) => {
            DriverM.find({
              isOnline: false,
            }).then((offline) => {
              const data = {
                busy: busy.length,
                online: online.length,
                offline: offline.length,
                total: busy.length + online.length + offline.length,
              };
              //console.log(data, "dfljklj");

              admins.forEach((admin) => {
                // console.log(admin);
                io.to(admin).emit("AdminGetCount", data);
              });
            });
          });
        });
      } else {
        DriverM.find({
          isBusy: true,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [data.lng, data.lat],
              },
              $maxDistance: data.maxDistance,
            },
          },
        }).then(async (busy) => {
          DriverM.find({
            isOnline: true,
            isBusy: false,
            location: {
              $near: {
                $geometry: {
                  type: "Point",
                  coordinates: [data.lng, data.lat],
                },
                $maxDistance: data.maxDistance,
              },
            },
          }).then(async (online) => {
            DriverM.find({
              isOnline: false,
              location: {
                $near: {
                  $geometry: {
                    type: "Point",
                    coordinates: [data.lng, data.lat],
                  },
                  $maxDistance: data.maxDistance,
                },
              },
            }).then((offline) => {
              const data = {
                busy: busy.length,
                online: online.length,
                offline: offline.length,
                total: busy.length + online.length + offline.length,
              };
              // console.log(data);

              admins.forEach((admin) => {
                // console.log(admin);
                io.to(admin).emit("AdminGetCount", data);
              });
            });
          });
        });
      }
    } catch (err) {
      console.log(err);
    }
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

const DistinationDuration = async (originlat, originlong, destinlong, destinlat) => {
  var resp = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json?origins=" +
    originlat +
    "," +
    originlong +
    "&destinations=" +
    destinlat +
    "," +
    destinlong +
    "&key=" +
    google_Key
  );
  // console.log(resp);
  return resp.data.rows[0].elements;
};

const tripCost = async (
  pickupLng,
  pickupLat,
  dropoffLng,
  dropoffLat,
  carCategory,
  discountType,
  discountValue
) => {
  const timedest = await DistinationDuration(
    pickupLat,
    pickupLng,
    dropoffLng,
    dropoffLat
  );
  var distanceTime = (timedest[0].duration.value / 60).toFixed();
  var distanceKM = (timedest[0].distance.value / 1000).toFixed(1);
  const CategoryFare = await CategoryFareM.findOne({
    categoryCarTypeID: carCategory,
  });
  const tax = await DeliverySettingM.find({
    sort: 1,
  });
  var KMCost = (distanceKM - CategoryFare.minKM) * CategoryFare.baseFare;
  var MinCost = distanceTime * CategoryFare.fareMinute;
  var MinFare = CategoryFare.minFare;
  var subTotal = KMCost + MinCost + MinFare;
  if (discountType != -1) {
    var discountCost =
      discountType === 1 ? discountValue : (subTotal * discountValue) / 100;
    var TotalAfterDis = subTotal - discountCost;
  } else {
    TotalAfterDis = subTotal;
  }
  var VatCost = (tax * TotalAfterDis) / 100;
  return (TotalAfterDis + VatCost).toFixed(2);
};

function AddMinutesToDate(date, minutes, min) {
  return new Date(date.getTime() + minutes * 60000 + min * 60000);
}
function DateFormat(date, language) {
  var hours = ((date.getHours() + 11) % 12) + 1;
  var minutes = date.getMinutes();
  minutes = minutes < 10 ? "0" + minutes : minutes;
  var ln =
    language == "ar" && date.getHours() < 12
      ? "ص"
      : language == "م" && date.getHours() >= 12
        ? "PM"
        : language == "en" && date.getHours() < 12
          ? "AM"
          : language == "en" && date.getHours() >= 12
            ? "PM"
            : "";

  var strTime = hours + ":" + minutes + " " + ln;
  console.log("wwwwwwwwwwww", ln, language);
  return strTime;
}
const driveTimeCalc = (time1, time2, language) => {
  console.log(language, time1, time2);
  var now = new Date();
  var next = AddMinutesToDate(now, time1, time2);
  return DateFormat(next, language);
};
