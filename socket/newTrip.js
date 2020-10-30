const axios = require("axios");

const DriverM = require("../models/Driver");
const CategoryFareM = require("../models/CategoryFare");
const TripM = require("../models/Trip");
const Pending = require("../models/Pending");
const DeliverySettingM = require("../models/DeliverySetting");

var {
    users,
    entitle,
    artitle,
    enmes,
    armes,
    nodrivertitlear,
    nodrivertitleen,
    notification_options,
    io,
    admin
} = require('../server');

var google_Key = "AIzaSyCKW4oeH-_tRtLAT_sWK9G7wbgEOpxWAzI";


module.exports = async function (data) {
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
            if ((!res.data.status || !res.data.data.isValid) && data.promoCode) {
                var user_id = users.get(data.userId);
                discountValue = -1;
                console.log(user_id);
                io.to(user_id).emit("promoCode", {
                    message: res.data.message,
                });
            } else if (res.data.data.isValid) {
                discountType = res.data.data.discountType;
                discountValue = res.data.data.discountValue;
            }
        });
    }
    console.log(discountType, discountValue);
    if (discountValue != -1) {
        var userID = data.userId;
        var pickupLat = data.pickupLat;
        var pickupLng = data.pickupLng;
        var dropoffLat = data.dropoffLat;
        var dropoffLng = data.dropoffLng;
        console.log(userID);
        DriverM.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [pickupLng, pickupLat],
                    },
                    //maxDistance: 5000,
                },
            },
            isBusy: false,
            isOnline: true,
            isDeleted: false,
            genderRequest: data.genderRequest,
            categoryCarTypeID: data.categoryCarTypeID,
        }).then(async (drivers) => {
            var Trip_ID;

            await axios({
                method: "post",
                url: "https://devmachine.taketosa.com/api/Trip/NewTrip",
                headers: {
                    Authorization: `Bearer ${data.token}`,
                    "Content-Type": "application / json",
                    "Accept-Language": data.Language,
                },
                data: {
                    pickupLat,
                    pickupLng,
                    pickupAddress: data.pickupAddress,
                    dropoffLat,
                    dropoffLng,
                    dropoffAddress: data.dropoffAddress,
                    promoCode: data.promoCode,
                    categoryCarTypeID: data.categoryCarTypeID,
                    paymentStatusId: data.paymentStatusID,
                    isWalletPay: data.isWalletPay,
                },
            }).then(async (res) => {
                if (res.data.status) {
                    Trip_ID = res.data.data.tripMasterId;
                    console.log(res.data.data.tripMasterId);

                    console.log("get drivers", drivers);
                    var dr = [];
                    const trip = new TripM({
                        pickupLat: pickupLat,
                        pickupLng: pickupLng,
                        pickupAddress: data.pickupAddress,
                        dropoffLat: dropoffLat,
                        dropoffLng: dropoffLng,
                        dropoffAddress: data.dropoffAddress,
                        promoCode: "" + data.promoCode,
                        categoryCarTypeID: data.categoryCarTypeID,
                        cancelReasonID: 0,
                        paymentStatusId: data.paymentStatusID,
                        isWalletPay: data.isWalletPay,
                        tripID: Trip_ID,
                        tripStatusId: 2,
                        tripDrivers: [],
                    });
                    console.log(trip);
                    const driverTime = await DistinationDuration(
                        pickupLat,
                        pickupLng,
                        dropoffLng,
                        dropoffLat
                    );
                    var dist = (driverTime[0].distance.value / 1000).toFixed();
                    if (dist === 0) dist++;
                    var from_to = {
                        pickupLat: pickupLat,
                        pickupLng: pickupLng,
                        pickupAddress: data.pickupAddress,
                        dropoffLat: dropoffLat,
                        dropoffLng: dropoffLng,
                        dropoffAddress: data.dropoffAddress,
                        userId: userID,
                        tripID: Trip_ID,
                        driverTime: (driverTime[0].duration.value / 60).toFixed(),
                        distance: dist,
                    };

                    var tripC = await tripCost(
                        pickupLng,
                        pickupLat,
                        dropoffLng,
                        dropoffLat,
                        data.categoryCarTypeID,
                        discountType,
                        discountValue
                    );

                    from_to.tripCost = tripC;

                    var cat = await CategoryFareM.findOne({
                        categoryCarTypeID: data.categoryCarTypeID,
                    });

                    var payment = "";

                    if (data.paymentStatusID === 1) payment = "Cash";
                    else if (data.paymentStatusID === 2) payment = "Net";
                    else payment = "PassengerWallet";

                    from_to.category =
                        data.Language == "ar"
                            ? cat.categoryCarNameAr + " , " + payment
                            : cat.categoryCarNameEn + " , " + payment;
                    if (drivers.length > 0) {
                        var reachTime = await DistinationDuration(
                            pickupLat,
                            pickupLng,
                            drivers[0].location.coordinates[0],
                            drivers[0].location.coordinates[1]
                        );

                        from_to.reachTime = (reachTime[0].duration.value / 60).toFixed();
                        from_to.arriveTime = driveTimeCalc(
                            0,
                            from_to.reachTime,
                            drivers[0].Language
                        );

                        const drs = [];
                        for (let i = 0; i < Math.min(drivers.length, 3); i++) {
                            drs.push({
                                driverID: drivers[i].driverID,
                                status: 0,
                            });
                        }
                        try {
                            console.log(Trip_ID, ";kopoi");
                            var postData;

                            if (drivers[0].deviceType == 1) {
                                // IOS
                                postData = {
                                    data: {
                                        PushType: "1",
                                        PushTitle:
                                            drivers[0].Language == "ar" ? artitle : entitle,
                                    },
                                    notification: {
                                        body: drivers[0].Language == "ar" ? armes : enmes,
                                        sound: "default",
                                    },
                                };
                            } else if (drivers[0].deviceType == 2) {
                                // Andriod
                                postData = {
                                    data: {
                                        PushType: "1",
                                        PushTitle:
                                            drivers[0].Language == "ar"
                                                ? artitle
                                                : entitle +
                                                    '",' +
                                                    '"PushMessage":"' +
                                                    data.Language ==
                                                    "ar"
                                                    ? armes
                                                    : enmes,
                                        content_available: "true",
                                        priority: "high",
                                    },
                                };
                            }

                            admin
                                .messaging()
                                .sendToDevice(
                                    drivers[0].tokenID,
                                    postData,
                                    notification_options
                                )
                                .then(async () => {
                                    const pending = new Pending({
                                        tripID: Trip_ID,
                                        pickupLat: pickupLat,
                                        pickupLng: pickupLng,
                                        pickupAddress: data.pickupAddress,
                                        dropoffLat: dropoffLat,
                                        dropoffLng: dropoffLng,
                                        dropoffAddress: data.dropoffAddress,
                                        userID: userID,
                                        driverTime: from_to.driverTime,
                                        distance: from_to.distance,
                                        tripCost: from_to.tripCost,
                                        category: from_to.category,
                                        reachTime: from_to.reachTime,
                                        arriveTime: from_to.arriveTime,
                                        arriveStatus: 0,
                                        drs: drs,
                                        registrationToken: data.registrationToken,
                                        loginToken: data.token,
                                        deviceType: data.deviceType,
                                        Language: data.Language,
                                    });
                                    //console.log("tttttttttttttttttttt",pending)
                                    const savedPending = await pending.save();
                                    const savedTrip = await trip.save();
                                    console.log(
                                        users.get(drivers[0].driverID),
                                        drivers[0].driverID
                                    );
                                    io
                                        .to(users.get(drivers[0].driverID))
                                        .emit("tripInfo", from_to);
                                    await Pending.findOne({ tripID: Trip_ID }).then(async (p) => {
                                        //console.log(p);
                                        let ar = p.drs;
                                        console.log(ar[0], p.drs);
                                        ar[0].status = -1;
                                        await Pending.updateOne(
                                            { tripID: Trip_ID },
                                            { $set: { drs: ar } }
                                        );
                                        console.log(ar, "update to -1");
                                    });

                                    var now = 0;

                                    let interval1 = setInterval(function () {
                                        now++;
                                        Pending.findOne({ tripID: Trip_ID }).then((pen107) => {
                                            console.log(pen107.drs[0], Trip_ID);
                                            if (pen107.drs[0].status !== -1) {
                                                clearInterval(interval1);
                                                console.log("clear ");
                                            }
                                        });
                                        if (now === 10) {
                                            io.emit("ready");
                                        }
                                        console.log(now);
                                        if (now === 20) {
                                            Pending.findOne({ tripID: Trip_ID }).then(
                                                async (saved) => {
                                                    if (saved.drs[0].status === -1) {
                                                        let array = saved.drs;
                                                        array[0].status = 3;
                                                        await Pending.updateOne(
                                                            { tripID: Trip_ID },
                                                            { $set: { drs: array } }
                                                        );
                                                    }
                                                    if (saved.drs.length === 1) {
                                                        DriverM.findOne({ driverID: saved.drs[0].driverID })
                                                            .then(async (savedDriver) => {
                                                                trip.tripDrivers.push({
                                                                    driverID: savedDriver.driverID,
                                                                    requestStatus: 3,
                                                                    lat: savedDriver.location.coordinates[1],
                                                                    lng: savedDriver.location.coordinates[0],
                                                                    actionDate: savedDriver.updateLocationDate,
                                                                });

                                                                trip.tripStatusId = 2;
                                                                await TripM.updateOne(
                                                                    { tripID: trip.tripID },
                                                                    {
                                                                        $set: {
                                                                            tripStatusId: trip.tripStatusId,
                                                                            tripDrivers: trip.tripDrivers,
                                                                        },
                                                                    }
                                                                );
                                                            })
                                                            .then(async () => {
                                                                await TripM.findOne({
                                                                    tripID: trip.tripID,
                                                                }).then((savedTr) => {
                                                                    console.log(savedTr, "627");
                                                                    try {
                                                                        console.log(data);
                                                                        axios({
                                                                            method: "post",
                                                                            url:
                                                                                "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                                            data: savedTr,
                                                                            headers: {
                                                                                Authorization: `Bearer ${data.token}`,
                                                                                "Content-Type": "application / json",
                                                                                "Accept-Language": data.Language,
                                                                            },
                                                                        }).then((res) => {
                                                                            io.to(users.get(data.userId)).emit(
                                                                                "tripInfo",
                                                                                {
                                                                                    status: 2,
                                                                                }
                                                                            );

                                                                            console.log("iiiiiii", res.data);
                                                                        });
                                                                    } catch (error) {
                                                                        console.log("abc");
                                                                    }
                                                                });
                                                            });
                                                    } else if (saved.drs.length > 1) {
                                                        DriverM.findOne({
                                                            driverID: saved.drs[0].driverID,
                                                        }).then(async (savedDriver) => {
                                                            trip.tripDrivers.push({
                                                                driverID: savedDriver.driverID,
                                                                requestStatus: 3,
                                                                lat: savedDriver.location.coordinates[1],
                                                                lng: savedDriver.location.coordinates[0],
                                                                actionDate: savedDriver.updateLocationDate,
                                                            });

                                                            trip.tripStatusId = 2;
                                                            await TripM.updateOne(
                                                                { tripID: Trip_ID },
                                                                {
                                                                    $set: {
                                                                        tripStatusId: trip.tripStatusId,
                                                                        tripDrivers: trip.tripDrivers,
                                                                    },
                                                                }
                                                            );
                                                        });

                                                        var reachTime = await DistinationDuration(
                                                            pickupLat,
                                                            pickupLng,
                                                            drivers[1].location.coordinates[0],
                                                            drivers[1].location.coordinates[1]
                                                        );

                                                        from_to.reachTime = (
                                                            reachTime[0].duration.value / 60
                                                        ).toFixed();
                                                        from_to.arriveTime = driveTimeCalc(
                                                            0,
                                                            from_to.reachTime,
                                                            drivers[1].Language
                                                        );

                                                        var postData;

                                                        if (drivers[1].deviceType == 1) {
                                                            // IOS
                                                            postData = {
                                                                data: {
                                                                    PushType: "1",
                                                                    PushTitle:
                                                                        drivers[1].Language == "ar"
                                                                            ? artitle
                                                                            : entitle,
                                                                },
                                                                notification: {
                                                                    body:
                                                                        drivers[1].Language == "ar"
                                                                            ? armes
                                                                            : enmes,
                                                                    sound: "default",
                                                                },
                                                            };
                                                        } else if (drivers[1].deviceType == 2) {
                                                            // Andriod
                                                            postData = {
                                                                data: {
                                                                    PushType: "1",
                                                                    PushTitle:
                                                                        drivers[1].Language == "ar"
                                                                            ? artitle
                                                                            : entitle,
                                                                    PushMessage:
                                                                        data.Language == "ar" ? armes : enmes,
                                                                    content_available: "true",
                                                                    priority: "high",
                                                                },
                                                            };
                                                        }
                                                        admin
                                                            .messaging()
                                                            .sendToDevice(
                                                                drivers[1].tokenID,
                                                                postData,
                                                                notification_options
                                                            );

                                                        /////
                                                        io
                                                            .to(users.get(drivers[1].driverID))
                                                            .emit("tripInfo", from_to);

                                                        await Pending.findOne({ tripID: Trip_ID }).then(
                                                            async (p12) => {
                                                                console.log(p12);
                                                                let ar = p12.drs;
                                                                ar[1].status = -1;
                                                                await Pending.updateOne(
                                                                    { tripID: trip.tripID },
                                                                    { $set: { drs: ar } }
                                                                );
                                                                console.log(ar, "update to -1");
                                                            }
                                                        );

                                                        var now2 = 0;
                                                        let interval43 = setInterval(function () {
                                                            now2++;
                                                            Pending.findOne({ tripID: Trip_ID }).then(
                                                                (pen109) => {
                                                                    console.log(pen109.drs[1], Trip_ID);
                                                                    if (pen109.drs[1].status !== -1) {
                                                                        clearInterval(interval43);
                                                                        console.log("clear second interval");
                                                                    }
                                                                    console.log(now2);
                                                                }
                                                            );
                                                            if (now2 === 20) {
                                                                Pending.findOne({
                                                                    tripID: Trip_ID,
                                                                }).then(async (saved) => {
                                                                    if (saved.drs[1].status === -1) {
                                                                        let array = saved.drs;
                                                                        array[1].status = 3;
                                                                        await Pending.updateOne(
                                                                            { tripID: trip.tripID },
                                                                            { $set: { drs: array } }
                                                                        );
                                                                    }

                                                                    if (saved.drs.length === 2) {
                                                                        await DriverM.findOne({
                                                                            driverID: saved.drs[1].driverID,
                                                                        })
                                                                            .then(async (savedDriver) => {
                                                                                const arr = await TripM.findOne({
                                                                                    tripID: trip.tripID,
                                                                                });
                                                                                console.log(arr.tripDrivers);
                                                                                arr.tripDrivers.push({
                                                                                    driverID: savedDriver.driverID,
                                                                                    requestStatus: 3,
                                                                                    lat:
                                                                                        savedDriver.location
                                                                                            .coordinates[1],
                                                                                    lng:
                                                                                        savedDriver.location
                                                                                            .coordinates[0],
                                                                                    actionDate:
                                                                                        savedDriver.updateLocationDate,
                                                                                });
                                                                                trip.tripStatusId = 2;
                                                                                await TripM.updateOne(
                                                                                    { tripID: trip.tripID },
                                                                                    {
                                                                                        $set: {
                                                                                            tripStatusId: trip.tripStatusId,
                                                                                            tripDrivers: arr.tripDrivers,
                                                                                        },
                                                                                    }
                                                                                );
                                                                            })
                                                                            .then(async () => {
                                                                                await TripM.findOne({
                                                                                    tripID: trip.tripID,
                                                                                }).then((savedTr) => {
                                                                                    try {
                                                                                        console.log(savedTr);
                                                                                        axios({
                                                                                            method: "post",
                                                                                            url:
                                                                                                "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                                                            data: savedTr,
                                                                                            headers: {
                                                                                                Authorization: `Bearer ${data.token}`,
                                                                                                "Content-Type":
                                                                                                    "application / json",
                                                                                                "Accept-Language":
                                                                                                    data.Language,
                                                                                            },
                                                                                        }).then((res) => {
                                                                                            console.log(res.data);
                                                                                            io.to(
                                                                                                users.get(data.userId)
                                                                                            ).emit("tripInfo", {
                                                                                                status: 2,
                                                                                            });
                                                                                        });
                                                                                    } catch (error) {
                                                                                        console.log("abc");
                                                                                    }
                                                                                });
                                                                            });
                                                                    } else {
                                                                        DriverM.findOne({
                                                                            driverID: saved.drs[1].driverID,
                                                                        }).then(async (savedDriver) => {
                                                                            trip.tripDrivers.push({
                                                                                driverID: savedDriver.driverID,
                                                                                requestStatus: 3,
                                                                                lat:
                                                                                    savedDriver.location.coordinates[1],
                                                                                lng:
                                                                                    savedDriver.location.coordinates[0],
                                                                                actionDate:
                                                                                    savedDriver.updateLocationDate,
                                                                            });

                                                                            trip.tripStatusId = 2;
                                                                            await TripM.updateOne(
                                                                                { tripID: trip.tripID },
                                                                                {
                                                                                    $set: {
                                                                                        tripStatusId: trip.tripStatusId,
                                                                                        tripDrivers: trip.tripDrivers,
                                                                                    },
                                                                                }
                                                                            );
                                                                        });
                                                                        var reachTime = await DistinationDuration(
                                                                            pickupLat,
                                                                            pickupLng,
                                                                            drivers[2].location.coordinates[0],
                                                                            drivers[2].location.coordinates[1]
                                                                        );

                                                                        from_to.reachTime = (
                                                                            reachTime[0].duration.value / 60
                                                                        ).toFixed();
                                                                        from_to.arriveTime = driveTimeCalc(
                                                                            0,
                                                                            from_to.reachTime,
                                                                            drivers[2].Language
                                                                        );

                                                                        var postData;

                                                                        if (drivers[2].deviceType == 1) {
                                                                            // IOS
                                                                            postData = {
                                                                                data: {
                                                                                    PushType: "1",
                                                                                    PushTitle:
                                                                                        drivers[2].Language == "ar"
                                                                                            ? artitle
                                                                                            : entitle,
                                                                                },
                                                                                notification: {
                                                                                    body:
                                                                                        drivers[2].Language == "ar"
                                                                                            ? armes
                                                                                            : enmes,
                                                                                    sound: "default",
                                                                                },
                                                                            };
                                                                        } else if (drivers[2].deviceType == 2) {
                                                                            // Andriod
                                                                            postData = {
                                                                                data: {
                                                                                    PushType: "1",
                                                                                    PushTitle:
                                                                                        drivers[2].Language == "ar"
                                                                                            ? artitle
                                                                                            : entitle,
                                                                                    PushMessage:
                                                                                        data.Language == "ar"
                                                                                            ? armes
                                                                                            : enmes,
                                                                                    content_available: "true",
                                                                                    priority: "high",
                                                                                },
                                                                            };
                                                                        }
                                                                        admin
                                                                            .messaging()
                                                                            .sendToDevice(
                                                                                drivers[2].tokenID,
                                                                                postData,
                                                                                notification_options
                                                                            );
                                                                        /////
                                                                        io
                                                                            .to(users.get(drivers[2].driverID))
                                                                            .emit("tripInfo", from_to);

                                                                        await Pending.findOne({
                                                                            tripID: Trip_ID,
                                                                        }).then(async (tr12) => {
                                                                            var ar = tr12.drs;
                                                                            ar[2].status = -1;
                                                                            await Pending.updateOne(
                                                                                { tripID: trip.tripID },
                                                                                { $set: { drs: ar } }
                                                                            );
                                                                        });
                                                                        var now3 = 0;
                                                                        let interval69 = setInterval(function () {
                                                                            now3++;
                                                                            Pending.findOne({ tripID: Trip_ID }).then(
                                                                                (pen110) => {
                                                                                    console.log(pen110.drs[2], Trip_ID);
                                                                                    if (pen110.drs[2].status !== -1) {
                                                                                        clearInterval(interval69);
                                                                                        console.log(
                                                                                            "clear second interval"
                                                                                        );
                                                                                    }
                                                                                    console.log(now3);
                                                                                }
                                                                            );
                                                                            if (now3 === 20) {
                                                                                Pending.findOne({
                                                                                    tripID: Trip_ID,
                                                                                }).then(async (saved) => {
                                                                                    if (saved.drs[2].status === -1) {
                                                                                        let array = saved.drs;
                                                                                        array[2].status = 3;
                                                                                        Pending.updateOne(
                                                                                            { tripID: trip.tripID },
                                                                                            { $set: { drs: array } }
                                                                                        );
                                                                                    }
                                                                                    DriverM.findOne({
                                                                                        driverID: saved.drs[2].driverID,
                                                                                    }).then(async (savedDriver) => {
                                                                                        try {
                                                                                            const arr = await TripM.findOne(
                                                                                                {
                                                                                                    tripID: trip.tripID,
                                                                                                }
                                                                                            );
                                                                                            arr.tripDrivers.push({
                                                                                                driverID:
                                                                                                    savedDriver.driverID,
                                                                                                requestStatus: 3,
                                                                                                lat:
                                                                                                    savedDriver.location
                                                                                                        .coordinates[1],
                                                                                                lng:
                                                                                                    savedDriver.location
                                                                                                        .coordinates[0],
                                                                                                actionDate:
                                                                                                    savedDriver.updateLocationDate,
                                                                                            });
                                                                                            trip.tripStatusId = 2;
                                                                                            await TripM.updateOne(
                                                                                                { tripID: trip.tripID },
                                                                                                {
                                                                                                    $set: {
                                                                                                        tripStatusId:
                                                                                                            trip.tripStatusId,
                                                                                                        tripDrivers:
                                                                                                            arr.tripDrivers,
                                                                                                    },
                                                                                                }
                                                                                            );
                                                                                            await TripM.findOne({
                                                                                                tripID: trip.tripID,
                                                                                            }).then((savedTr) => {
                                                                                                try {
                                                                                                    console.log(savedTr);
                                                                                                    axios({
                                                                                                        method: "post",
                                                                                                        url:
                                                                                                            "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                                                                        data: savedTr,
                                                                                                        headers: {
                                                                                                            Authorization: `Bearer ${data.token}`,
                                                                                                            "Content-Type":
                                                                                                                "application / json",
                                                                                                            "Accept-Language":
                                                                                                                data.Language,
                                                                                                        },
                                                                                                    }).then((res) => {
                                                                                                        io.to(
                                                                                                            users.get(data.userId)
                                                                                                        ).emit("tripInfo", {
                                                                                                            status: 2,
                                                                                                        });
                                                                                                        console.log(res.data);
                                                                                                    });
                                                                                                } catch (error) {
                                                                                                    console.log("abc");
                                                                                                }
                                                                                            });
                                                                                        } catch (error) {
                                                                                            console.log("hammoud");
                                                                                        }
                                                                                    });
                                                                                });
                                                                                clearInterval(interval69);
                                                                                console.log("clear interval69");
                                                                            }
                                                                        }, 1000);
                                                                    }
                                                                });
                                                                clearInterval(interval43);
                                                                console.log("clear interval43");
                                                            }
                                                        }, 1000);
                                                        ///////////
                                                    }
                                                }
                                            );
                                            clearInterval(interval1);
                                            console.log("clear interval1");
                                        }
                                    }, 1000);
                                });
                        } catch (error) {
                            console.log(error);
                        }
                    } else {
                        const pending = new Pending({
                            tripID: Trip_ID,
                            pickupLat: pickupLat,
                            pickupLng: pickupLng,
                            pickupAddress: data.pickupAddress,
                            dropoffLat: dropoffLat,
                            dropoffLng: dropoffLng,
                            dropoffAddress: data.dropoffAddress,
                            userId: userID,
                            driverTime: from_to.driveTime,
                            distance: from_to.distance,
                            tripCost: from_to.tripCost,
                            category: from_to.category,
                            reachTime: from_to.reachTime,
                            arriveTime: from_to.arriveTime,
                            arriveStatus: 0,
                            drs: [],
                            registrationToken: data.registrationToken,
                            loginToken: data.token,
                            deviceType: data.deviceType,
                            Language: data.Language,
                        });
                        const savedPending = await pending.save();
                        Pending.findOne({ tripID: trip.tripID }).then(async (res1) => {
                            trip.tripStatusId = 2;
                            trip.tripDrivers = [];
                            await trip.save().then((res) => {
                                console.log(res);
                                try {
                                    console.log(res1, "yup");
                                    axios({
                                        method: "post",
                                        url:
                                            "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                        data: res,
                                        headers: {
                                            Authorization: `Bearer ${res1.loginToken}`,
                                            "Content-Type": "application / json",
                                            "Accept-Language": data.Language,
                                        },
                                    }).then((res2) => {
                                        console.log(res2.data);

                                        if (res2.data.status) {
                                            var postData;

                                            if (res1.deviceType == 1) {
                                                // IOS
                                                postData = {
                                                    data: {
                                                        PushType: "2",
                                                        PushTitle:
                                                            res1.Language == "ar"
                                                                ? nodrivertitlear
                                                                : nodrivertitleen,
                                                    },
                                                    notification: {
                                                        body:
                                                            res1.Language == "ar"
                                                                ? nodrivertitlear
                                                                : nodrivertitleen,
                                                        sound: "default",
                                                    },
                                                };
                                            } else if (res1.deviceType == 2) {
                                                // Andriod
                                                postData = {
                                                    data: {
                                                        PushType: "2",
                                                        PushTitle:
                                                            res1.Language == "ar"
                                                                ? nodrivertitlear
                                                                : nodrivertitleen,
                                                        PushMessage:
                                                            res1.Language == "ar"
                                                                ? nodrivertitlear
                                                                : nodrivertitleen,
                                                        content_available: "true",
                                                        priority: "high",
                                                    },
                                                };
                                            }
                                            admin
                                                .messaging()
                                                .sendToDevice(
                                                    res1.registrationToken,
                                                    postData,
                                                    notification_options
                                                );

                                            io.to(users.get(data.userId)).emit("tripInfo", {
                                                status: 2,
                                            });
                                        }
                                    });
                                } catch (error) {
                                    console.log(error);
                                }
                            });
                        });
                    }
                } else {
                    var user_id = users.get(data.userId);

                    io.to(user_id).emit("newTrip", {
                        message: "error sql trip id",
                        status: false,
                    });
                }
            });
        });
    }
}

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