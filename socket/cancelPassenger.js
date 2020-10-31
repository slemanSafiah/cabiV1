const axios = require("axios");

const DriverM = require("../models/Driver");
const TripM = require("../models/Trip");
const Pending = require("../models/Pending");
var { users, notification_options, io, admin } = require('../server');


module.exports = async function (data) {
    TripM.findOne({ tripID: data.tripMasterID }).then(async (resp) => {
        if (resp) {
            console.log(resp);
            await axios({
                method: "post",
                url: `https://devmachine.taketosa.com/api/Trip/CancelTripPassenger?tripMasterID=${data.tripMasterID}&cancelReasonID=${data.cancelReasonID}`,
                headers: {
                    "Content-Type": "application / json",
                    Authorization: "Bearer " + data.token,
                    "Accept-Language": data.Language,
                },
            }).then(async (res) => {
                if (res.data.status) {
                    await Pending.findOne({ tripID: data.tripMasterID }).then(
                        async (pend) => {
                            var arr = pend.drs;
                            for (let j = 0; j < arr.length; j++) {
                                if (arr[j].status === 1) {
                                    await DriverM.find({ driverID: arr[j].driverID }).then(
                                        (driver) => {
                                            io.to(users.get(driver.driverID)).emit(
                                                "cancelPassenger",
                                                res.data.message
                                            );

                                            var postData;

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
                                        }
                                    );
                                    break;
                                }
                            }
                        }
                    );

                    io.to(users.get(data.userId)).emit("cancelPassenger", {
                        status: true,
                    });
                } else {
                    io.to(users.get(data.userId)).emit("CancelOnWay", {
                        status: false,
                        msg: "error in sql",
                    });
                }
            });
        } else {
            Pending.findOne({ tripID: data.tripMasterID }).then(async (pend) => {
                var arr = pend.drs;
                for (let j = 0; j < arr.length; j++) {
                    if (arr[j].status === -1) {
                        arr[j].status = 4;
                        await Pending.updateOne(
                            { tripID: data.tripMasterID },
                            { $set: { drs: arr } }
                        );
                    }
                }
                var drv = [];
                for (let i = 0; i < arr.length; i++) {
                    await DriverM.findOne({ driverID: arr[i].driverID }).then((dr) => {
                        drv.push({
                            tripID: data.tripMasterID,
                            driverID: dr.driverID,
                            lat: dr.location.coordinates[1],
                            lng: dr.location.coordinates[0],
                            requestStatus: arr[i].status,
                            actionDate: dr.updateLocationDate,
                        });
                    });
                }
                await TripM.updateOne(
                    { tripID: data.tripMasterID },
                    { $set: { cancelReasonID: data.cancelReasonID, tripDrivers: drv } }
                );
                await TripM.findOne({ tripID: data.tripMasterID }).then((trip) => {
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
                            console.log("aqqqqqqqq", res);
                            if (!res || res.data.status === false) {
                                console.log(res.data);
                                io.to(users.get(data.userId)).emit("CancelOnWay", {
                                    status: false,
                                    msg: "error in sql",
                                });
                            } else {
                                io.to(users.get(data.userId)).emit("CancelOnWay", {
                                    status: true,
                                });
                                Pending.findOne({ tripID: data.tripMasterID }).then(
                                    async (pend) => {
                                        var arr = pend.drs;
                                        for (let j = 0; j < arr.length; j++) {
                                            if (arr[j].status === 4) {
                                                await DriverM.find({ driverID: arr[j].driverID }).then(
                                                    (driver) => {
                                                        var postData;

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
                                                    }
                                                );
                                            }
                                        }
                                    }
                                );
                            }
                        });
                    } catch (error) {
                        io.to(users.get(data.userId)).emit("CancelOnWay", {
                            status: false,
                            msg: "error in mongodb",
                        });
                    }
                });
            });
        }
    });
}