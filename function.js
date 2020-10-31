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

module.exports.DistinationDuration = async function (originlat, originlong, destinlong, destinlat) {
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

module.exports.tripCost = async function (pickupLng, pickupLat, dropoffLng, dropoffLat, carCategory, discountType, discountValue) {
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
        var discountCost = discountType === 1 ? discountValue : (subTotal * discountValue) / 100;
        var TotalAfterDis = subTotal - discountCost;
    } else {
        TotalAfterDis = subTotal;
    }
    var VatCost = (tax * TotalAfterDis) / 100;
    return (TotalAfterDis + VatCost).toFixed(2);
};
module.exports.AddMinutesToDate = function (date, minutes, min) {
    return new Date(date.getTime() + minutes * 60000 + min * 60000);
}
module.exports.DateFormat = function (date, language) {
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
module.exports.driveTimeCalc = function (time1, time2, language) {
    console.log(language, time1, time2);
    var now = new Date();
    var next = AddMinutesToDate(now, time1, time2);
    return DateFormat(next, language);
};
