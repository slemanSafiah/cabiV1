const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const DriverM = require("../models/Driver");
const CategoryFareM = require("../models/CategoryFare");

var { users, listinterval, io } = require('../server');
var { DistinationDuration, tripCost, driveTimeCalc } = require('../function');

module.exports = async function (data) {
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
}
