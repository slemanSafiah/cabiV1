const Driver = require("../models/Driver");
const Pending = require("../models/Pending");
const axios = require("axios");

var { users, notification_options, io, admin } = require('../server');

module.exports = async function (data) {
    try {
        console.log(data);
        await Driver.findOne({ driverID: data.driverID }).then(async (driver) => {
            await Pending.findOne({ tripID: data.tripId }).then(async (trip) => {
                console.log(users.get(trip.userID), trip.userID);
                const config = {
                    method: "post",
                    url: `https://devmachine.taketosa.com/api/Trip/UpdateTripStatus?tripId=${data.tripId}&tripStatusType=${data.tripStatusType}&Lat=${data.Lat}&Lang=${data.Lang}`,
                    headers: {
                        "Content-Type": "application / json",
                        Authorization: "Bearer " + data.token,
                        "Accept-Language": data.Language,
                    },
                };
                try {
                    let tripstatus = await axios(config).then((res) => {
                        console.log("uyuyuyu", res.data);
                        if (res.data.status) {
                            if (data.tripStatusType != 4) {
                                socket.to(users.get(trip.userID)).emit("TrackInfo", {
                                    tripID: data.tripId,
                                    status: true,
                                    message:
                                        trip.Language == "ar"
                                            ? res.data.data.titleAr
                                            : res.data.data.titleEn,
                                });
                            }
                            socket.to(users.get(data.driverID)).emit("ChangeTripStatus", {
                                tripID: data.tripId,
                                status: true,
                                data: res.data.data,
                            });

                            var postData;

                            if (trip.deviceType == 1) {
                                // IOS
                                postData = {
                                    data: {
                                        PushType: "6",
                                        PushTitle:
                                            trip.Language == "ar"
                                                ? res.data.data.titleAr
                                                : res.data.data.titleEn,
                                    },
                                    notification: {
                                        body:
                                            trip.Language == "ar"
                                                ? res.data.data.bodyAr
                                                : res.data.data.bodyEn,
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
                                                ? res.data.data.titleAr
                                                : res.data.data.titleEn,
                                        PushMessage:
                                            trip.Language == "ar"
                                                ? res.data.data.bodyAr
                                                : res.data.data.bodyEn,
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
                        } else {
                            socket.to(users.get(data.driverID)).emit("ChangeTripStatus", {
                                tripID: data.tripId,
                                status: false,
                                message: res.data.messag,
                            });
                        }
                    });
                } catch {
                    socket.to(users.get(data.driverID)).emit("ChangeTripStatus", {
                        tripID: data.tripId,
                        status: false,
                        message: "error in sql",
                    });
                }
            });
        });
    } catch {
        socket.to(users.get(data.driverID)).emit("ChangeTripStatus", {
            tripID: data.tripId,
            status: false,
            message: "error in socketio",
        });
    }
}