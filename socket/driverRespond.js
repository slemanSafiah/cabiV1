const axios = require("axios");

const DriverM = require("../models/Driver");
const CategoryFareM = require("../models/CategoryFare");
const TripM = require("../models/Trip");
const Pending = require("../models/Pending");
const DeliverySettingM = require("../models/DeliverySetting");

var {
    users,
    admins,
    entitle,
    artitle,
    enmes,
    armes,
    nodrivermesar,
    nodrivermesen,
    nodrivertitlear,
    nodrivertitleen,
    notification_options,
    io,
    admin
} = require('../server');

module.exports = async function (data) {
    console.log("-------------------------------- this is the end");
    const tripArr = await TripM.findOne({ tripID: data.tripID });
    console.log(tripArr);
    var tripCond = false;
    if (tripArr != null) {
        for (let r = 0; r < tripArr.tripDrivers.length; r++) {
            if (tripArr.tripDrivers[r].driverID === data.driverID) {
                tripCond = true;
                break;
            }
        }
    }
    var user;
    console.log(tripCond)
    if (tripCond === false) {
        console.log("uuuuuuuuuuuuuuuuu");
        await Pending.findOne({ tripID: data.tripID }).then(async (pe) => {
            let ar = pe.drs;
            user = pe.userID;
            console.log(user, "opoperer");
            for (let j = 0; j < ar.length; j++) {
                if (ar[j].driverID === data.driverID) {
                    ar[j].status = data.requestStatus;
                    break;
                }
            }
            await Pending.updateOne({ tripID: data.tripID }, { $set: { drs: ar } });
            console.log(ar, "update to -1");
        });
        if (data.requestStatus === 1) {
            Pending.findOne({ tripID: data.tripID }).then(async (saved) => {
                let array = saved.drs;
                console.log(array, "nnnnnnnnnn");
                var idx = 0;
                for (let i = 0; i < array.length; i++) {
                    if (array[i].driverID === data.driverID) {
                        array[i].status = 1;
                        idx = i;
                    }
                }
                console.log(array);
                // await DriverM.updateOne({driverID:data.driverID},{$set:{isBusy:true}}).then(
                // async()=>{
                await Pending.updateOne(
                    { tripID: data.tripID },
                    { $set: { drs: array } }
                ).then(() => {
                    Pending.findOne({ tripID: data.tripID }).then((saved1) => {
                        TripM.findOne({ tripID: data.tripID }).then((savedTrip) => {
                            DriverM.findOne({ driverID: saved.drs[idx].driverID }).then(
                                async (savedDriver) => {
                                    try {
                                        var trip = savedTrip;
                                        //console.log(saved1.drs, 'a7a');
                                        for (let l = 0; l < saved1.drs.length; l++) {
                                            if (saved1.drs[l].status !== 0) {
                                                await DriverM.findOne({
                                                    driverID: saved1.drs[l].driverID,
                                                }).then((d) => {
                                                    //console.log(d, 'dddddddd')
                                                    trip.tripDrivers.push({
                                                        driverID: d.driverID,
                                                        requestStatus: saved1.drs[l].status,
                                                        lat: d.location.coordinates[1],
                                                        lng: d.location.coordinates[0],
                                                        actionDate: d.updateLocationDate,
                                                    });
                                                });
                                            }
                                        }
                                        trip.tripStatusId = 3;
                                        //console.log(trip, "trip");
                                        console.log("beforeTrip");
                                        const data19 = {
                                            status:
                                                savedDriver.isOnline === true &&
                                                    savedDriver.isBusy == false
                                                    ? 1
                                                    : savedDriver.isOnline == true &&
                                                        savedDriver.isBusy == true
                                                        ? 2
                                                        : savedDriver.isOnline == false
                                                            ? 3
                                                            : 0,
                                            driverID: savedDriver.driverID,
                                            location: savedDriver.location,
                                            categoryCarTypeID: savedDriver.categoryCarTypeID,
                                            phoneNumber: savedDriver.phoneNumber,
                                            idNo: savedDriver.idNo,
                                            driverNameAr: savedDriver.driverNameAr,
                                            driverNameEn: savedDriver.driverNameEn,
                                            modelNameAr: savedDriver.modelNameAr,
                                            modelNameEn: savedDriver.modelNameEn,
                                            colorNameAr: savedDriver.colorNameAr,
                                            colorNameEn: savedDriver.colorNameEn,
                                            carImage: savedDriver.carImage,
                                            driverImage: savedDriver.driverImage,
                                            updateLocationDate: savedDriver.updateLocationDate,
                                            trip: savedDriver.isBusy ? savedDriver.busyTrip : "",
                                        };
                                        //console.log("data", data);
                                        admins.forEach((admin) => {
                                            io.to(admin).emit("trackAdmin", data19);
                                            io.to(admin).emit("trackCount");
                                        });
                                        await TripM.updateOne(
                                            { tripID: trip.tripID },
                                            {
                                                $set: {
                                                    tripStatusId: trip.tripStatusId,
                                                    tripDrivers: trip.tripDrivers,
                                                },
                                            }
                                        ).then(() => {
                                            console.log("before");
                                            TripM.findOne({ tripID: trip.tripID }).then((savedTr) => {
                                                console.log(savedTr, "after");
                                                try {
                                                    axios({
                                                        method: "post",
                                                        url:
                                                            "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                        data: savedTr,
                                                        headers: {
                                                            Authorization: `Bearer ${saved1.loginToken}`,
                                                            "Content-Type": "application / json",
                                                        },
                                                    }).then(async (res) => {
                                                        console.log("ewewrwerwerw", res.data);
                                                        if (res.data.status) {
                                                            io.to(users.get(savedDriver.driverID)).emit(
                                                                "success",
                                                                {
                                                                    status: true,
                                                                    condition: true,
                                                                    passengerName: res.data.data.passengerName,
                                                                    passengerMobile:
                                                                        res.data.data.passengerMobile,
                                                                    passengerImage:
                                                                        res.data.data.passengerImage,
                                                                    passengerRate: res.data.data.passengerRate,
                                                                }
                                                            );

                                                            var comeInClock = await driveTimeCalc(
                                                                0,
                                                                saved.reachTime,
                                                                savedDriver.Language
                                                            );
                                                            var obj = res.data.data;
                                                            obj.lat = savedDriver.location.coordinates[1];
                                                            obj.lng = savedDriver.location.coordinates[0];
                                                            obj.comeIn = "" + saved.reachTime;
                                                            obj.comeInClock = "" + comeInClock;
                                                            obj.tripCost = saved.tripCost;
                                                            obj.status = 1;
                                                            console.log("trippppppppp", obj);
                                                            console.log(users.get(user), user);
                                                            io.to(users.get(user)).emit("tripInfo", obj);

                                                            var postData;

                                                            if (saved1.deviceType == 1) {
                                                                // IOS
                                                                postData = {
                                                                    data: {
                                                                        PushType: "3",
                                                                        PushTitle:
                                                                            saved1.Language == "ar"
                                                                                ? " الكابتن في الطريق إليك"
                                                                                : "Your Captain on the way",
                                                                    },
                                                                    notification: {
                                                                        body:
                                                                            saved1.Language == "ar"
                                                                                ? `الكابتن${res.data.data.driverNameAr} في طريقه إليك بمركبة ${res.data.data.Model} ، رقم لوحة ${res.data.data.taxiNumber}`
                                                                                : `Captain${res.data.data.driverNameEn} is on his way in a ${res.data.data.Model} plate number ${res.data.data.taxiNumber}`,
                                                                        sound: "default",
                                                                    },
                                                                };
                                                            } else if (saved1.deviceType == 2) {
                                                                // Andriod
                                                                postData = {
                                                                    data: {
                                                                        PushType: "3",
                                                                        PushTitle:
                                                                            saved1.Language == "ar"
                                                                                ? " الكابتن في الطريق إليك"
                                                                                : "Your Captain on the way",
                                                                        PushMessage:
                                                                            saved1.Language == "ar"
                                                                                ? `الكابتن${res.data.data.driverNameAr} في طريقه إليك بمركبة ${res.data.data.Model} ، رقم لوحة ${res.data.data.taxiNumber}`
                                                                                : `Captain${res.data.data.driverNameEn} is on his way in a ${res.data.data.Model} plate number ${res.data.data.taxiNumber}`,
                                                                        content_available: "true",
                                                                        priority: "high",
                                                                    },
                                                                };
                                                            }
                                                            admin
                                                                .messaging()
                                                                .sendToDevice(
                                                                    saved1.registrationToken,
                                                                    postData,
                                                                    notification_options
                                                                );

                                                            console.log(
                                                                users.get(saved.userID),
                                                                "iiiiiiiiiii",
                                                                saved.userID
                                                            );
                                                        } else if (!res || res.data.status === false) {
                                                            console.log(123);
                                                            io.to(users.get(savedDriver.driverID)).emit(
                                                                "success",
                                                                {
                                                                    status: false,
                                                                    condition: true,
                                                                }
                                                            );

                                                            io.to(users.get(user)).emit("tripInfo", {
                                                                status: 0,
                                                            });
                                                        }
                                                    });
                                                } catch (error) {
                                                    console.log("abc");
                                                }
                                            });
                                        });
                                    } catch (error) {
                                        console.log("haha");
                                    }
                                }
                            );
                        });
                    });
                });
                //})
            });
        } else {
            console.log("adadddddddddad");
            Pending.findOne({ tripID: data.tripID }).then(async (pendingTrip) => {
                let array = pendingTrip.drs;
                var idx = 0;
                for (let i = 0; i < array.length; i++) {
                    if (array[i].driverID === data.driverID) {
                        array[i].status = 2;
                        idx = i;
                    }
                }
                await Pending.updateOne(
                    { tripID: data.tripID },
                    { $set: { drs: array } }
                ).then(() => {
                    io.to(users.get(data.driverID)).emit("success", {
                        status: true,
                        condition: false,
                    });
                    Pending.findOne({ tripID: data.tripID }).then(
                        async (updatedPending) => {
                            console.log("reject and show", updatedPending);
                            var idx2 = -1;
                            let array2 = updatedPending.drs;
                            console.log(array2, updatedPending.drs);
                            for (let j = 0; j < array2.length; j++) {
                                if (array2[j].status === 0) {
                                    idx2 = j;
                                    console.log(array2[j]);
                                    break;
                                }
                            }
                            if (idx2 === -1) {
                                Pending.findOne({ tripID: data.tripID }).then(
                                    async (pendingTrip2) => {
                                        console.log(pendingTrip2, "black lives is matter");
                                        var array3 = [];
                                        for (let k = 0; k < pendingTrip2.drs.length; k++) {
                                            await DriverM.findOne({
                                                driverID: pendingTrip2.drs[k].driverID,
                                            }).then((savedDriver) => {
                                                array3.push({
                                                    driverID: savedDriver.driverID,
                                                    requestStatus: pendingTrip2.drs[k].status,
                                                    lat: savedDriver.location.coordinates[1],
                                                    lng: savedDriver.location.coordinates[0],
                                                    actionDate: savedDriver.updateLocationDate,
                                                });
                                            });
                                        }
                                        await TripM.updateOne(
                                            { tripID: data.tripID },
                                            { $set: { tripDrivers: array3, tripStatusId: 2 } }
                                        ).then(() => {
                                            TripM.findOne({ tripID: data.tripID }).then((savedTr) => {
                                                try {
                                                    console.log(savedTr);
                                                    axios({
                                                        method: "post",
                                                        url:
                                                            "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                        data: savedTr,
                                                        headers: {
                                                            Authorization: `Bearer ${pendingTrip2.loginToken}`,
                                                            "Content-Type": "application / json",
                                                        },
                                                    }).then((res) => {
                                                        if (!res || res.data.status === false) {
                                                            console.log(res.data);
                                                            io.to(
                                                                users.get(pendingTrip2.userID)
                                                            ).emit("tripInfo", { status: 0 });
                                                        } else {
                                                            console.log("qqqqqqqqqqqqttttttttttttt");

                                                            var postData;

                                                            if (pendingTrip2.deviceType == 1) {
                                                                // IOS
                                                                postData = {
                                                                    data: {
                                                                        PushType: "2",
                                                                        PushTitle:
                                                                            pendingTrip2.Language == "ar"
                                                                                ? nodrivertitlear
                                                                                : nodrivertitleen,
                                                                    },
                                                                    notification: {
                                                                        body:
                                                                            pendingTrip2.Language == "ar"
                                                                                ? nodrivermesar
                                                                                : nodrivermesen,
                                                                        sound: "default",
                                                                    },
                                                                };
                                                            } else if (saved1.deviceType == 2) {
                                                                // Andriod
                                                                postData = {
                                                                    data: {
                                                                        PushType: "2",
                                                                        PushTitle:
                                                                            pendingTrip2.Language == "ar"
                                                                                ? nodrivertitlear
                                                                                : nodrivertitleen,
                                                                        PushMessage:
                                                                            pendingTrip2.Language == "ar"
                                                                                ? nodrivermesar
                                                                                : nodrivermesen,
                                                                        content_available: "true",
                                                                        priority: "high",
                                                                    },
                                                                };
                                                            }
                                                            admin
                                                                .messaging()
                                                                .sendToDevice(
                                                                    pendingTrip2.registrationToken,
                                                                    postData,
                                                                    notification_options
                                                                );

                                                            io.to(
                                                                users.get(pendingTrip2.userID)
                                                            ).emit("tripInfo", { status: 2 });
                                                        }
                                                    });
                                                } catch (error) {
                                                    console.log("dada");
                                                }
                                            });
                                        });
                                    }
                                );
                            } else {
                                DriverM.findOne({ driverID: array2[idx2].driverID }).then(
                                    async (driver) => {
                                        var reachTime1 = await DistinationDuration(
                                            pendingTrip.pickupLat,
                                            pendingTrip.pickupLng,
                                            driver.location.coordinates[0],
                                            driver.location.coordinates[1]
                                        );
                                        var reachTime = (
                                            reachTime1[0].duration.value / 60
                                        ).toFixed();
                                        var arriveTime = driveTimeCalc(
                                            0,
                                            reachTime,
                                            driver.Language
                                        );

                                        var postData;

                                        if (driver.deviceType == 1) {
                                            // IOS
                                            postData = {
                                                data: {
                                                    PushType: "1",
                                                    PushTitle:
                                                        driver.Language == "ar" ? artitle : entitle,
                                                },
                                                notification: {
                                                    body: driver.Language == "ar" ? armes : enmes,
                                                    sound: "default",
                                                },
                                            };
                                        } else if (driver.deviceType == 2) {
                                            // Andriod
                                            postData = {
                                                data: {
                                                    PushType: "1",
                                                    PushTitle:
                                                        driver.Language == "ar" ? artitle : entitle,
                                                    PushMessage:
                                                        driver.Language == "ar" ? armes : enmes,
                                                    content_available: "true",
                                                    priority: "high",
                                                },
                                            };
                                        }
                                        admin
                                            .messaging()
                                            .sendToDevice(
                                                driver.registrationToken,
                                                postData,
                                                notification_options
                                            );

                                        var from_to = updatedPending;
                                        from_to.reachTime = reachTime;
                                        from_to.arriveTime = arriveTime;
                                        io
                                            .to(users.get(driver.driverID))
                                            .emit("tripInfo", from_to);

                                        await Pending.findOne({ tripID: data.tripID }).then(
                                            async (p1) => {
                                                let ar1 = p1.drs;
                                                ar1[idx2].status = -1;
                                                await Pending.updateOne(
                                                    { tripID: data.tripID },
                                                    { $set: { drs: ar1 } }
                                                );
                                            }
                                        );

                                        var now = 0;
                                        console.log(from_to);
                                        let interval4 = setInterval(async function () {
                                            now++;
                                            await Pending.findOne({ tripID: data.tripID }).then(
                                                (pen7) => {
                                                    if (pen7.drs[idx2].status !== -1) {
                                                        clearInterval(interval4, "clear interval4");
                                                    }
                                                }
                                            );
                                            console.log(now);
                                            if (now === 20) {
                                                await Pending.findOne({ tripID: data.tripID }).then(
                                                    async (pendingTripE) => {
                                                        console.log(pendingTripE.drs, "eeeeeeeeeeeeeeee");
                                                        if (pendingTripE.drs[idx2].status === -1) {
                                                            let array = pendingTripE.drs;
                                                            array[idx2].status = 3;
                                                            await Pending.updateOne(
                                                                { tripID: data.tripID },
                                                                { $set: { drs: array } }
                                                            );
                                                            await Pending.findOne({
                                                                tripID: data.tripID,
                                                            }).then((updatedPending3) => {
                                                                console.log(
                                                                    updatedPending3,
                                                                    "after second ignore"
                                                                );
                                                                var idx3 = -1;
                                                                var array6 = updatedPending3.drs;
                                                                for (let n = 0; n < array6.length; n++) {
                                                                    if (array6[n].status === 0) {
                                                                        idx3 = n;
                                                                        break;
                                                                    }
                                                                }
                                                                if (idx3 === -1) {
                                                                    console.log(updatedPending3, 33333333);
                                                                    TripM.findOne({ tripID: data.tripID }).then(
                                                                        async (trip11) => {
                                                                            var finalDrivers = [];
                                                                            for (
                                                                                let q = 0;
                                                                                q < array6.length;
                                                                                q++
                                                                            ) {
                                                                                await DriverM.findOne({
                                                                                    driverID: array6[q].driverID,
                                                                                }).then((driver) => {
                                                                                    finalDrivers.push({
                                                                                        driverID: driver.driverID,
                                                                                        requestStatus: array6[q].status,
                                                                                        lat:
                                                                                            driver.location.coordinates[1],
                                                                                        lng:
                                                                                            driver.location.coordinates[0],
                                                                                        actionDate:
                                                                                            driver.updateLocationDate,
                                                                                    });
                                                                                });
                                                                            }
                                                                            console.log(finalDrivers, "final");
                                                                            let data1 = trip11;
                                                                            data1.tripStatusId = 2;
                                                                            data1.tripDrivers = finalDrivers;
                                                                            console.log(data1);
                                                                            await TripM.updateOne(
                                                                                { tripID: data.tripID },
                                                                                {
                                                                                    $set: {
                                                                                        tripStatusId: 2,
                                                                                        tripDrivers: finalDrivers,
                                                                                    },
                                                                                }
                                                                            ).then(() => {
                                                                                TripM.findOne({
                                                                                    tripID: data.tripID,
                                                                                }).then((res1) => {
                                                                                    try {
                                                                                        console.log(res1, "important");
                                                                                        axios({
                                                                                            method: "post",
                                                                                            url:
                                                                                                "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                                                            data: res1,
                                                                                            headers: {
                                                                                                Authorization: `Bearer ${updatedPending3.loginToken}`,
                                                                                                "Content-Type":
                                                                                                    "application / json",
                                                                                            },
                                                                                        }).then((res3) => {
                                                                                            console.log("popopop", res3);

                                                                                            if (
                                                                                                !res3 ||
                                                                                                res3.data.status === false
                                                                                            ) {
                                                                                                console.log(res3.dara);
                                                                                                io.to(
                                                                                                    users.get(
                                                                                                        updatedPending3.userID
                                                                                                    )
                                                                                                ).emit("tripInfo", {
                                                                                                    status: 0,
                                                                                                });
                                                                                            } else {
                                                                                                var postData;

                                                                                                if (
                                                                                                    updatedPending3.deviceType ==
                                                                                                    1
                                                                                                ) {
                                                                                                    // IOS
                                                                                                    postData = {
                                                                                                        data: {
                                                                                                            PushType: "2",
                                                                                                            PushTitle:
                                                                                                                updatedPending3.Language ==
                                                                                                                    "ar"
                                                                                                                    ? nodrivertitlear
                                                                                                                    : nodrivertitleen,
                                                                                                        },
                                                                                                        notification: {
                                                                                                            body:
                                                                                                                updatedPending3.Language ==
                                                                                                                    "ar"
                                                                                                                    ? nodrivermesar
                                                                                                                    : nodrivermesen,
                                                                                                            sound: "default",
                                                                                                        },
                                                                                                    };
                                                                                                } else if (
                                                                                                    updatedPending3.deviceType ==
                                                                                                    2
                                                                                                ) {
                                                                                                    // Andriod
                                                                                                    postData = {
                                                                                                        data: {
                                                                                                            PushType: "2",
                                                                                                            PushTitle:
                                                                                                                updatedPending3.Language ==
                                                                                                                    "ar"
                                                                                                                    ? nodrivertitlear
                                                                                                                    : nodrivertitleen,
                                                                                                            PushMessage:
                                                                                                                updatedPending3.Language ==
                                                                                                                    "ar"
                                                                                                                    ? nodrivermesar
                                                                                                                    : nodrivermesen,
                                                                                                            content_available:
                                                                                                                "true",
                                                                                                            priority: "high",
                                                                                                        },
                                                                                                    };
                                                                                                }
                                                                                                admin
                                                                                                    .messaging()
                                                                                                    .sendToDevice(
                                                                                                        updatedPending3.registrationToken,
                                                                                                        postData,
                                                                                                        notification_options
                                                                                                    );

                                                                                                io.to(
                                                                                                    users.get(
                                                                                                        updatedPending3.userID
                                                                                                    )
                                                                                                ).emit("tripInfo", {
                                                                                                    status: 2,
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    } catch (error) {
                                                                                        console.log("abc");
                                                                                    }
                                                                                });
                                                                            });
                                                                        }
                                                                    );
                                                                } else {
                                                                    DriverM.findOne({
                                                                        driverID: array6[idx3].driverID,
                                                                    }).then((dr) => {
                                                                        console.log(dr, "third driver");
                                                                        Pending.findOne({
                                                                            tripID: data.tripID,
                                                                        }).then(async (pen) => {
                                                                            console.log(pen, "pennnn");
                                                                            var from_to = pen;
                                                                            var reachTime1 = await DistinationDuration(
                                                                                pen.pickupLat,
                                                                                pen.pickupLng,
                                                                                dr.location.coordinates[0],
                                                                                dr.location.coordinates[1]
                                                                            );
                                                                            var reachTime = (
                                                                                reachTime1[0].duration.value / 60
                                                                            ).toFixed();
                                                                            var arriveTime = driveTimeCalc(
                                                                                0,
                                                                                reachTime,
                                                                                dr.Language
                                                                            );

                                                                            var postData;

                                                                            if (dr.deviceType == 1) {
                                                                                // IOS
                                                                                postData = {
                                                                                    data: {
                                                                                        PushType: "1",
                                                                                        PushTitle:
                                                                                            dr.Language == "ar"
                                                                                                ? artitle
                                                                                                : entitle,
                                                                                    },
                                                                                    notification: {
                                                                                        body:
                                                                                            dr.Language == "ar"
                                                                                                ? armes
                                                                                                : enmes,
                                                                                        sound: "default",
                                                                                    },
                                                                                };
                                                                            } else if (dr.deviceType == 2) {
                                                                                // Andriod
                                                                                postData = {
                                                                                    data: {
                                                                                        PushType: "1",
                                                                                        PushTitle:
                                                                                            dr.Language == "ar"
                                                                                                ? artitle
                                                                                                : entitle,
                                                                                        PushMessage:
                                                                                            dr.Language == "ar"
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
                                                                                    dr.tokenID,
                                                                                    postData,
                                                                                    notification_options
                                                                                );

                                                                            from_to.reachTime = reachTime;
                                                                            from_to.arriveTime = arriveTime;
                                                                            io.to(users.get(dr.driverID)).emit(
                                                                                "tripInfo",
                                                                                from_to
                                                                            );
                                                                            await Pending.findOne({
                                                                                tripID: data.tripID,
                                                                            }).then(async (trip2) => {
                                                                                var arr3 = trip2.drs;
                                                                                arr3[idx3].status = -1;
                                                                                await Pending.updateOne(
                                                                                    { tripID: data.tripID },
                                                                                    { $set: { drs: arr3 } }
                                                                                );
                                                                            });
                                                                            var now115 = 0;
                                                                            let interval15 = setInterval(
                                                                                async function () {
                                                                                    now115++;
                                                                                    console.log(now115, "now115");
                                                                                    await Pending.findOne({
                                                                                        tripID: data.tripID,
                                                                                    }).then((tr13) => {
                                                                                        if (
                                                                                            tr13.drs[idx3].status !== -1
                                                                                        ) {
                                                                                            clearInterval(interval15);
                                                                                        }
                                                                                    });
                                                                                    if (now115 === 20) {
                                                                                        Pending.findOne({
                                                                                            tripID: data.tripID,
                                                                                        }).then(async (pen115) => {
                                                                                            console.log("needed", pen115);
                                                                                            if (
                                                                                                pen115.drs[idx3].status === -1
                                                                                            ) {
                                                                                                var array77 = pen115.drs;
                                                                                                array77[idx3].status = 3;
                                                                                                await Pending.updateOne(
                                                                                                    { tripID: data.tripID },
                                                                                                    { $set: { drs: array77 } }
                                                                                                ).then(async () => {
                                                                                                    var array123 = [];
                                                                                                    for (
                                                                                                        let r = 0;
                                                                                                        r < pen115.drs.length;
                                                                                                        r++
                                                                                                    ) {
                                                                                                        await DriverM.findOne({
                                                                                                            driverID:
                                                                                                                pen115.drs[r]
                                                                                                                    .driverID,
                                                                                                        }).then((tmpDriver) => {
                                                                                                            array123.push({
                                                                                                                driverID:
                                                                                                                    tmpDriver.driverID,
                                                                                                                requestStatus:
                                                                                                                    pen115.drs[r]
                                                                                                                        .status,
                                                                                                                lat:
                                                                                                                    tmpDriver.location
                                                                                                                        .coordinates[1],
                                                                                                                lng:
                                                                                                                    tmpDriver.location
                                                                                                                        .coordinates[0],
                                                                                                                actionDate:
                                                                                                                    tmpDriver.updateLocationDate,
                                                                                                            });
                                                                                                        });
                                                                                                    }
                                                                                                    console.log(array123);
                                                                                                    await TripM.updateOne(
                                                                                                        { tripID: data.tripID },
                                                                                                        {
                                                                                                            $set: {
                                                                                                                tripStatusId: 2,
                                                                                                                tripDrivers: array123,
                                                                                                            },
                                                                                                        }
                                                                                                    ).then(() => {
                                                                                                        TripM.findOne({
                                                                                                            tripID: data.tripID,
                                                                                                        }).then((trip321) => {
                                                                                                            try {
                                                                                                                console.log(
                                                                                                                    trip321,
                                                                                                                    "1563"
                                                                                                                );
                                                                                                                axios({
                                                                                                                    method: "post",
                                                                                                                    url:
                                                                                                                        "https://devmachine.taketosa.com/api/Trip/UpdateTrip",
                                                                                                                    data: trip321,
                                                                                                                    headers: {
                                                                                                                        Authorization: `Bearer ${pen115.loginToken}`,
                                                                                                                        "Content-Type":
                                                                                                                            "application / json",
                                                                                                                    },
                                                                                                                }).then((res3) => {
                                                                                                                    if (
                                                                                                                        !res3 ||
                                                                                                                        res3.data
                                                                                                                            .status ===
                                                                                                                        false
                                                                                                                    ) {
                                                                                                                        console.log(
                                                                                                                            res3.data
                                                                                                                        );
                                                                                                                        io.to(
                                                                                                                            users.get(
                                                                                                                                pen115.userID
                                                                                                                            )
                                                                                                                        ).emit(
                                                                                                                            "tripInfo",
                                                                                                                            { status: 0 }
                                                                                                                        );
                                                                                                                    } else {
                                                                                                                        var postData;

                                                                                                                        if (
                                                                                                                            pen115.deviceType ==
                                                                                                                            1
                                                                                                                        ) {
                                                                                                                            // IOS
                                                                                                                            postData = {
                                                                                                                                data: {
                                                                                                                                    PushType:
                                                                                                                                        "2",
                                                                                                                                    PushTitle:
                                                                                                                                        pen115.Language ==
                                                                                                                                            "ar"
                                                                                                                                            ? nodrivertitlear
                                                                                                                                            : nodrivertitleen,
                                                                                                                                },
                                                                                                                                notification: {
                                                                                                                                    body:
                                                                                                                                        pen115.Language ==
                                                                                                                                            "ar"
                                                                                                                                            ? nodrivermesar
                                                                                                                                            : nodrivermesen,
                                                                                                                                    sound:
                                                                                                                                        "default",
                                                                                                                                },
                                                                                                                            };
                                                                                                                        } else if (
                                                                                                                            pen115.deviceType ==
                                                                                                                            2
                                                                                                                        ) {
                                                                                                                            // Andriod
                                                                                                                            postData = {
                                                                                                                                data: {
                                                                                                                                    PushType:
                                                                                                                                        "2",
                                                                                                                                    PushTitle:
                                                                                                                                        pen115.Language ==
                                                                                                                                            "ar"
                                                                                                                                            ? nodrivertitlear
                                                                                                                                            : nodrivertitleen,
                                                                                                                                    PushMessage:
                                                                                                                                        pen115.Language ==
                                                                                                                                            "ar"
                                                                                                                                            ? nodrivermesar
                                                                                                                                            : nodrivermesen,
                                                                                                                                    content_available:
                                                                                                                                        "true",
                                                                                                                                    priority:
                                                                                                                                        "high",
                                                                                                                                },
                                                                                                                            };
                                                                                                                        }
                                                                                                                        admin
                                                                                                                            .messaging()
                                                                                                                            .sendToDevice(
                                                                                                                                pen115.registrationToken,

                                                                                                                                postData,
                                                                                                                                notification_options
                                                                                                                            );

                                                                                                                        io.to(
                                                                                                                            users.get(
                                                                                                                                pen115.userID
                                                                                                                            )
                                                                                                                        ).emit(
                                                                                                                            "tripInfo",
                                                                                                                            { status: 2 }
                                                                                                                        );
                                                                                                                    }
                                                                                                                });
                                                                                                            } catch (error) {
                                                                                                                console.log("abc");
                                                                                                            }
                                                                                                        });
                                                                                                    });
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                },
                                                                                1000
                                                                            );
                                                                        });
                                                                    });
                                                                }
                                                            });
                                                        } else {
                                                            //repeat driver responed
                                                        }
                                                    }
                                                );
                                                clearInterval(interval4);
                                                console.log("clearInterval14");
                                            }
                                        }, 1000);
                                    }
                                );
                            }
                        }
                    );
                });
            });
        }
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
