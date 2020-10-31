const DriverM = require("../models/Driver");
const { v4: uuidv4 } = require("uuid");

var { users, userinterval, io } = require('../server');

module.exports = async function (data) {
    //console.log(data);
    const id = uuidv4();
    userinterval.set(data.userid, id);
    try {
        DriverM.find({
            isBusy: false,
            isOnline: true,
            isDeleted: false,
            genderRequest: data.genderRequest,
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [data.long, data.lat],
                    },
                    //   $maxDistance: 5000,
                },
            },
        }).then(async (res) => {
            //console.log(res,"eeeeeeee");
            var near = res[0];
            if (near) {
                const time = await DistinationDuration(
                    near.location.coordinates[1],
                    near.location.coordinates[0],
                    data.long,
                    data.lat
                );
                var driversList = [];
                res.map((driver) => {
                    const temp = {
                        lat: driver.location.coordinates[1],
                        lng: driver.location.coordinates[0],
                        driverID: driver.driverID,
                        oldLat: driver.oldLocation.coordinates[1],
                        oldLng: driver.oldLocation.coordinates[0],
                    };
                    if (driversList.length < 5) driversList.push(temp);
                });
                const data1 = {
                    drivers: driversList,
                    time:
                        time[0].duration == undefined
                            ? -1
                            : (time[0].duration.value / 60).toFixed(),
                    status: time[0].duration == undefined ? false : true,
                    msg: time[0].duration == undefined ? "error google api" : "",
                };
                //console.log(data1);
                let user_id = users.get(data.userid);
                // console.log(user_id);
                io.to(user_id).emit("getavailable", data1);
            } else {
                const data1 = {
                    drivers: [],
                    time: -1,
                    status: false,
                    msg: "no driver available",
                };
                let user_id = users.get(data.userid);
                // console.log(user_id);
                io.to(user_id).emit("getavailable", data1);
            }
        });
        const fun = () => {
            if (
                users.get(data.userid) == undefined ||
                userinterval.get(data.userid) != id
            ) {
                clearInterval(interval);
                //console.log("kkkkkkkkk");
            }
            DriverM.find({
                isBusy: false,
                isOnline: true,
                isDeleted: false,
                genderRequest: data.genderRequest,
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [data.long, data.lat],
                        },
                        //   $maxDistance: 5000,
                    },
                },
            }).then(async (res) => {
                var near = res[0];
                //console.log(near);
                if (near) {
                    const time = await DistinationDuration(
                        near.location.coordinates[1],
                        near.location.coordinates[0],
                        data.long,
                        data.lat
                    );
                    var driversList = [];
                    res.map((driver) => {
                        const temp = {
                            lat: driver.location.coordinates[1],
                            lng: driver.location.coordinates[0],
                            driverID: driver.driverID,
                            oldLat: driver.oldLocation.coordinates[1],
                            oldLng: driver.oldLocation.coordinates[0],
                        };
                        if (driversList.length < 5) driversList.push(temp);
                    });
                    const data1 = {
                        drivers: driversList,
                        time:
                            time[0].duration == undefined
                                ? -1
                                : (time[0].duration.value / 60).toFixed(),
                        status: time[0].duration == undefined ? false : true,
                        msg: time[0].duration == undefined ? "error google api" : "",
                    };
                    if (
                        users.get(data.userid) != undefined &&
                        userinterval.get(data.userid) == id
                    ) {
                        let user_id = users.get(data.userid);
                        //console.log(user_id);

                        io.to(user_id).emit("getavailable", data1);
                    }
                } else {
                    const data1 = {
                        drivers: [],
                        time: -1,
                        status: false,
                        msg: "no driver available",
                    };
                    if (
                        users.get(data.userid) != undefined &&
                        userinterval.get(data.userid) == id
                    ) {
                        let user_id = users.get(data.userid);
                        // console.log(user_id);

                        io.to(user_id).emit("getavailable", data1);
                    }
                }
                //console.log(data1.time)
            });
        };
        var interval = setInterval(fun, 20000);
    } catch (err) {
        console.log(err);
        let user_id = users.get(data.userid);
        // console.log(user_id);
        io.to(user_id).emit("getavailable", {
            status: false,
            msg: "location out of bounds",
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
