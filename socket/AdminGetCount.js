const DriverM = require("../models/Driver");
const axios = require("axios");
var { admins, io } = require('../server');

module.exports = async function (data) {
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
}