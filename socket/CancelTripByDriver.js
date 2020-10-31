const axios = require("axios");
const Pending = require("../models/Pending");
var { users, notification_options, io, admin } = require('../server');

module.exports = async function (data) {
    try {
        console.log(data);
        Pending.findOne({ tripID: data.tripMasterID }).then(async (trip) => {
            // console.log(trip);

            const config = {
                method: "post",
                url: `https://devmachine.taketosa.com/api/Trip/CancelTrip?tripMasterID=${data.tripMasterID}&cancelReasonID=${data.cancelReasonID}&Lat=${data.Lat}&Lang=${data.Lang}`,
                headers: {
                    "Content-Type": "application / json",
                    Authorization: "Bearer " + data.token,
                    "Accept-Language": data.Language,
                },
            };
            try {
                let promoResponse = await axios(config).then((res) => {
                    console.log("uyuyuyu", res.data);
                    if (res.data.status) {
                        io.to(users.get(trip.userID)).emit("CancelTripByDriver", {
                            message: res.data.message,
                            status: true,
                        });

                        io.to(users.get(data.driverID)).emit("CancelTripByDriver", {
                            status: true,
                        });

                        var postData;

                        if (trip.deviceType == 1) {
                            // IOS
                            postData = {
                                data: {
                                    PushType: "4",
                                    PushTitle:
                                        trip.Language == "ar"
                                            ? "!عفوا ، الكابتن قام بإلغاء الرحلة"
                                            : "Sorry, Captain canceled the trip!",
                                },
                                notification: {
                                    body:
                                        trip.Language == "ar"
                                            ? `Captain ${res.data.data.driverNameEn} canceled the trip; you can try again!`
                                            : `!لكابتن ${res.data.data.driverNameAr} قام بالغاء الرحلة يمكنك المحاولة مرة أخرى`,
                                    sound: "default",
                                },
                            };
                        } else if (trip.deviceType == 2) {
                            // Andriod
                            postData = {
                                data: {
                                    PushType: "4",
                                    PushTitle:
                                        trip.Language == "ar"
                                            ? "!عفوا ، الكابتن قام بإلغاء الرحلة"
                                            : "Sorry, Captain canceled the trip!",
                                    PushMessage:
                                        trip.Language == "ar"
                                            ? `Captain ${res.data.data.driverNameEn} canceled the trip; you can try again!`
                                            : `!لكابتن ${res.data.data.driverNameAr} قام بالغاء الرحلة يمكنك المحاولة مرة أخرى`,
                                    content_available: "true",
                                    priority: "high",
                                },
                            };
                        }
                        admin.messaging().sendToDevice(
                            trip.registrationToken,
                            postData,

                            notification_options
                        );
                    } else {
                        io.to(users.get(data.driverID)).emit("CancelTripByDriver", {
                            status: false,
                            message: "error in sql",
                        });
                    }
                });
            } catch (error) {
                console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
                // console.log(error);
                io.to(users.get(data.driverID)).emit("CancelTripByDriver", {
                    status: false,
                    message: "error in sql",
                });
            }
        });
    } catch {
        io.to(users.get(data.driverID)).emit("CancelTripByDriver", {
            status: false,
            message: "error in mongodb",
        });
    }
}