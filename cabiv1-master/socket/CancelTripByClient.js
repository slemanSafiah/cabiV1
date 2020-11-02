const axios = require("axios");

const DriverM = require("../models/Driver");
const TripM = require("../models/Trip");
const Pending = require("../models/Pending");
var {users, notification_options} = require("../server");
const admin = require("firebase-admin");

module.exports = async function (data, socket, io) {
  console.log("bmnbnmbmn", data);
  try {
    await TripM.findOne({tripID: data.tripMasterID}).then(async (resp) => {
      console.log("kljkljkl", resp);
      if (resp.tripStatusId == 3) {
        console.log("kljjlkj");
        await axios({
          method: "post",
          url: `https://devmachine.taketosa.com/api/Trip/CancelTripPassenger?tripMasterID=${data.tripMasterID}&cancelReasonID=${data.cancelReasonID}`,
          headers: {
            "Content-Type": "application / json",
            Authorization: "Bearer " + data.token,
            "Accept-Language": data.Language,
          },
        }).then(async (res) => {
          console.log(res.data);
          if (res.data.status) {
            await Pending.findOne({tripID: data.tripMasterID}).then(
              async (pend) => {
                var arr = pend.drs;
                for (let j = 0; j < arr.length; j++) {
                  if (arr[j].status === 1) {
                    await DriverM.find({driverID: arr[j].driverID}).then(
                      (driver) => {
                        console.log("oioipo", driver[0]);
                        io.to(
                          users.get(driver[0].driverID)
                        ).emit("CancelTripByClient", {
                          data: res.data.message,
                          status: true,
                          message:
                            driver[0].Language == "en"
                              ? "Sorry,the client canceled your ride"
                              : "عفوا العميل قام بإلغاء الرحلة",
                        });
                        console.log(
                          users.get(data.userId),
                          driver[0].tokenID,
                          "kklljklj",
                          users,
                          data.userId
                        );
                        socket.emit("CancelTripByClient", {
                          status: true,
                          message: "succes",
                        });
                        var postData;
                        if (driver.deviceType == 1) {
                          // IOS
                          postData = {
                            data: {
                              PushType: "5",
                              PushTitle:
                                driver[0].Language == "ar"
                                  ? "!عفوا ، الزبون قام بإلغاء الرحلة"
                                  : "Sorry, Passenger canceled the trip!",
                            },
                            notification: {
                              body:
                                driver[0].Language == "ar"
                                  ? "عفوا ، الزبون قام بإلغاء الرحلة، وسنبحث لك عن رحلة أخرى"
                                  : "Sorry, the passenger has canceled the trip, and we are looking for another trip for you!",
                              sound: "default",
                            },
                          };
                        } else if (driver.deviceType == 2) {
                          // Andriod
                          postData = {
                            data: {
                              PushType: "5",
                              PushTitle:
                                driver[0].Language == "ar"
                                  ? "!عفوا ، الزبون قام بإلغاء الرحلة"
                                  : "Sorry, Passenger canceled the trip!",
                              PushMessage:
                                driver[0].Language == "ar"
                                  ? "عفوا ، الزبون قام بإلغاء الرحلة، وسنبحث لك عن رحلة أخرى"
                                  : "Sorry, the passenger has canceled the trip, and we are looking for another trip for you!",
                              content_available: "true",
                              priority: "high",
                            },
                          };
                        }
                        admin
                          .messaging()
                          .sendToDevice(
                            driver[0].tokenID,
                            postData,
                            notification_options
                          );
                      }
                    );
                    break;
                  }
                }
              }
            );
          } else {
            socket.emit("CancelTripByClient", {
              status: false,
              message: "error in sql",
            });
          }
        });
      } else {
        console.log("rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr");
        Pending.findOne({tripID: data.tripMasterID}).then(async (pend) => {
          var arr = pend.drs;
          for (let j = 0; j < arr.length; j++) {
            if (arr[j].status === -1) {
              arr[j].status = 4;
              await Pending.updateOne(
                {tripID: data.tripMasterID},
                {$set: {drs: arr}}
              );
            }
          }
          var drv = [];
          for (let i = 0; i < arr.length; i++) {
            await DriverM.findOne({driverID: arr[i].driverID}).then((dr) => {
              drv.push({
                tripID: data.tripMasterID,
                driverID: dr.driverID,
                lat: dr.location.coordinates[1],
                lng: dr.location.coordinates[0],
                requestStatus: arr[i].status,
                actionDate: new Date(),
              });
            });
          }
          await TripM.updateOne(
            {tripID: data.tripMasterID},
            {
              $set: {
                cancelReasonID: data.cancelReasonID,
                tripDrivers: drv,
                tripStatusId: 8,
              },
            }
          );
          await TripM.findOne({tripID: data.tripMasterID}).then((trip) => {
            try {
              console.log("save canceled trip", trip);
              trip.genderRequest = 2;
              axios({
                method: "post",
                url: "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                data: trip,
                headers: {
                  "Content-Type": "application / json",
                  Authorization: "Bearer " + pend.loginToken,
                  "Accept-Language": data.Language,
                },
              }).then(async (res) => {
                console.log("aqqqqqqqq", res.data);
                if (!res || res.data.status === false) {
                  console.log(res.data);
                  socket.emit("CancelOnWay", {
                    status: false,
                    message: "error in sql",
                  });
                } else {
                  socket.emit("CancelTripByClient", {status: true});
                  Pending.findOne({tripID: data.tripMasterID}).then(
                    async (pend) => {
                      var arr = pend.drs;
                      for (let j = 0; j < arr.length; j++) {
                        if (arr[j].status === 4) {
                          await DriverM.findOne({
                            driverID: arr[j].driverID,
                          }).then((driver) => {
                            var postData;
                            console.log(users.get(arr[j].driverID));
                            io.to(
                              users.get(arr[j].driverID)
                            ).emit("CancelTripByClient", {
                              status: true,
                              message:
                                driver.Language == "en"
                                  ? "Sorry,the client canceled your ride"
                                  : "عفوا العميل قام بإلغاء الرحلة",
                            });

                            if (driver.deviceType == 1) {
                              // IOS
                              postData = {
                                data: {
                                  PushType: "5",
                                  PushTitle:
                                    driver.Language == "ar"
                                      ? "!عفوا ، الزبون قام بإلغاء الرحلة"
                                      : "Sorry, Passenger canceled the trip!",
                                },
                                notification: {
                                  body:
                                    driver.Language == "ar"
                                      ? "عفوا ، الزبون قام بإلغاء الرحلة، وسنبحث لك عن رحلة أخرى"
                                      : "Sorry, the passenger has canceled the trip, and we are looking for another trip for you!",
                                  sound: "default",
                                },
                              };
                            } else if (driver.deviceType == 2) {
                              // Andriod
                              postData = {
                                data: {
                                  PushType: "5",
                                  PushTitle:
                                    driver.Language == "ar"
                                      ? "!عفوا ، الزبون قام بإلغاء الرحلة"
                                      : "Sorry, Passenger canceled the trip!",
                                  PushMessage:
                                    driver.Language == "ar"
                                      ? "عفوا ، الزبون قام بإلغاء الرحلة، وسنبحث لك عن رحلة أخرى"
                                      : "Sorry, the passenger has canceled the trip, and we are looking for another trip for you!",
                                  content_available: "true",
                                  priority: "high",
                                },
                              };
                            }

                            admin.messaging().sendToDevice(
                              driver.tokenID,
                              postData,

                              notification_options
                            );
                          });
                        }
                      }
                    }
                  );
                }
              });
            } catch (error) {
              socket.emit("CancelTripByClient", {
                status: false,
                message: "error in mongodb",
              });
            }
          });
        });
      }
    });
  } catch {
    console.log("pppppppppppppppppppppp");
  }
};
