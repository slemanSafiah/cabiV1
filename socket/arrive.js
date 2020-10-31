const Driver = require("../models/Driver");
const Pending = require("../models/Pending");
const axios = require("axios");

var { users, notification_options, io, admin } = require('../server');

module.exports = async function (data) {
    try {
        console.log(data);
        await Driver.findOne({ driverID: data.driverID }).then(async (driver) => {
            await Pending.findOne({ tripID: data.tripID }).then((trip) => {
                console.log(users.get(trip.userID), trip.userID);
                io
                    .to(users.get(trip.userID))
                    .emit("arrive", { tripID: data.tripID, status: true });
                io
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
}