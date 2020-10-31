const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const DriverM = require("../models/Driver");
const CategoryFareM = require("../models/CategoryFare");

var { users, trackinterval, io, } = require('../server');

module.exports = async function (data) {
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
