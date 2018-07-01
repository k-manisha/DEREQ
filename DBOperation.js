
const Joi = require('joi');
const MongoConnector = require('./MongoConnector');
const mongoConnector = new MongoConnector.MongoConnector();

const ACTION_DB_OPEN = "DB_OPEN";
const ACTION_QUERY_COMPLETE = "DB_QUERY_COMPLETE";
const ACTION_DEVICE_CREATE = "DB_DEVICE_CREATE";
const ACTION_DEVICE_UPDATE = "DB_DEVICE_UPDATE";
const ACTION_DEVICE_DELETE = "DB_DEVICE_DELETE";
const ACTION_UNIT_CREATE = "DB_UNIT_CREATE";
const ACTION_UNIT_UPDATE = "DB_UNIT_UPDATE";
const ACTION_UNIT_DELETE = "DB_UNIT_DELETE";
const ACTION_EMPLOYEE_CREATE = "DB_EMPLOYEE_CREATE";
const ACTION_EMPLOYEE_UPDATE = "DB_EMPLOYEE_UPDATE";
const ACTION_EMPLOYEE_DELETE = "DB_EMPLOYEE_DELETE";

const RESULT_OK = "RESULT_OK";
const RESULT_ERROR = "RESULT_ERROR";
const RESULT_BAD_DATA = "RESULT_BAD_DATA";
const RESULT_NO_SUCH_DATA = "RESULT_NO_SUCH_DATA";
const RESULT_DUPLICATE_ID = "RESULT_DUPLICATE_ID";

const COLLECTION_NAME_DEVICE = "device_collection";
const COLLECTION_NAME_UNIT = "unit_collection";
const COLLECTION_NAME_EMPLOYEE = "employee_collection";

const KEY_CHANGES = "changes";

const KEY_DEVICE_ID = "DeviceID";
const KEY_DEVICE_NAME = "DeviceName";

const KEY_UNIT_ID = "UnitID";
const KEY_EMPLOYEE_REGISTRATION_ID = "EmployeeRegistrationID";

const KEY_EMPLOYEE_ID = "EmployeeID";
const KEY_EMPLOYEE_NAME = "EmployeeName";
const KEY_EMPLOYEE_MOBILE = "MobileNo";
const KEY_EMPLOYEE_EMAIL = "Email";
const KEY_EMPLOYEE_ISACTIVE = "IsActive";
const KEY_EMPLOYEE_ISADMIN = "IsAdmin";
const KEY_EMPLOYEE_PASSWD = "Password";
const KEY_EMPLOYEE_TOKEN = "token";

class DBOperation {

    constructor(port, url, DBname) {
        this.url = url;
        this.port = port;
        this.DBName = DBname;
        this.DBUrl = `mongodb://${this.url}:${this.port}/`;
    }

    queryDB(collectionName, jsonQuery, callback) {
        mongoConnector.onMongoConnect(this.DBUrl, callback, (db) => {
            if (db) {
                db.db(this.DBName).collection(collectionName).find(jsonQuery).toArray((err, res) => {
                    if (err) {
                        db.close();
                        callback(ACTION_QUERY_COMPLETE, {"result": RESULT_ERROR, "response": err});
                    }
                    else if (res.length === 0) {
                        db.close();
                        callback(ACTION_QUERY_COMPLETE, {
                            "result": RESULT_NO_SUCH_DATA,
                            "response": "No data with query params: " + JSON.stringify(jsonQuery)
                        });
                    }
                    else {
                        db.close();
                        callback(ACTION_QUERY_COMPLETE, {"result": RESULT_OK, "response": res});
                    }
                });
            }
        });
    }

    addToDB(jsonData, requiredSchema, ifAllowUnknown, collectionName, uniqueIDName, actionName, callback){

        mongoConnector.onMongoConnect(this.DBUrl, callback, (db) => {
            if (db) {

                let uDID = {}, uUID = {}, uEID = {};
                uDID[KEY_DEVICE_ID] = 1;
                uUID[KEY_UNIT_ID] = 1;
                uEID[KEY_EMPLOYEE_ID] = 1;
                db.db(this.DBName).collection(COLLECTION_NAME_DEVICE).createIndex(uDID, {unique: true});
                db.db(this.DBName).collection(COLLECTION_NAME_UNIT).createIndex(uUID, {unique: true});
                db.db(this.DBName).collection(COLLECTION_NAME_EMPLOYEE).createIndex(uEID, {unique: true});

                const result = Joi.validate(jsonData, requiredSchema, {allowUnknown: ifAllowUnknown});

                if (result.error) callback(actionName, {"result": RESULT_BAD_DATA, "response": result.error.details[0].message});
                else {

                    let search_item = {};
                    search_item[uniqueIDName] = jsonData[uniqueIDName];

                    this.queryDB(collectionName, search_item, (request, response) => {

                        if (response.result === RESULT_NO_SUCH_DATA){

                            db.db(this.DBName).collection(collectionName).insert(jsonData, (err, res) => {
                                db.close();
                                if (err) {
                                    callback(actionName, {
                                        "result": RESULT_ERROR,
                                        "response": "Insert error: " + err
                                    });
                                }
                                else {
                                    callback(actionName, {"result": RESULT_OK, "response": res})
                                }
                            })

                        }

                        else if (response.result === RESULT_OK){

                            callback(actionName, {
                                "result": RESULT_DUPLICATE_ID,
                                "response": `${uniqueIDName}: ${jsonData[uniqueIDName]}`
                            });

                        }

                        else {
                            callback(actionName, {
                                "result": RESULT_ERROR,
                                "response": "Validation error " + response.response
                            })
                        }

                    });
                }
            }
        });

    }

    updateDB(jsonData, requiredSchema, ifAllowUnknown, collectionName, uniqueIDName, actionName, callback){

        mongoConnector.onMongoConnect(this.DBUrl, callback, (db) => {
            if (db) {

                const preSchema = {};
                preSchema[uniqueIDName] = Joi.required();
                preSchema[KEY_CHANGES] = Joi.required();

                let JoiResult = Joi.validate(jsonData, preSchema);

                if (JoiResult.error) callback(actionName, {"result": RESULT_BAD_DATA, "response": JoiResult.error.details[0].message});
                else {

                    let search_original_id = {};
                    search_original_id[uniqueIDName] = jsonData[uniqueIDName];

                    this.queryDB(collectionName, search_original_id, (request, response1) => {

                        if (response1.result === RESULT_OK){

                            JoiResult = Joi.validate(jsonData[KEY_CHANGES], requiredSchema, {allowUnknown: ifAllowUnknown});

                            if (JoiResult.error) callback(actionName, {"result": RESULT_BAD_DATA, "response": JoiResult.error.details[0].message});
                            else {

                                let search_updated_id = {};
                                search_updated_id[uniqueIDName] = jsonData[KEY_CHANGES][uniqueIDName];

                                this.queryDB(collectionName, search_updated_id, (request, response2) => {

                                    if (response2.result === RESULT_NO_SUCH_DATA) {

                                        let combined_doc = response1.response[0];
                                        for (let key1 in jsonData[KEY_CHANGES]) {
                                            combined_doc[key1] = jsonData[KEY_CHANGES][key1];
                                        }
                                        let updated_doc = {};
                                        for (let key2 in combined_doc) {
                                            if (combined_doc[key2])
                                                updated_doc[key2] = combined_doc[key2];
                                        }

                                        db.db(this.DBName).collection(collectionName).update(search_original_id, updated_doc, (err, res) => {

                                            db.close();
                                            if (err) {
                                                callback(actionName, {
                                                    "result": RESULT_ERROR,
                                                    "response": "Update error: " + err
                                                });
                                            }
                                            else callback(actionName, {"result": RESULT_OK, "response": res});
                                        })

                                    }

                                    else if (response2.result === RESULT_OK) {
                                        db.close();
                                        callback(actionName, {
                                            "result": RESULT_DUPLICATE_ID,
                                            "response": `Changed ID ${updated_doc[uniqueIDName]} already exists.`
                                        });
                                    }

                                    else {
                                        db.close();
                                        callback(actionName, {
                                            "result": RESULT_ERROR,
                                            "response": "Updated validation error " + response2.response
                                        })
                                    }

                                })
                            }

                        }

                        else if (response1.result === RESULT_NO_SUCH_DATA){

                            callback(actionName, {
                                "result": RESULT_NO_SUCH_DATA,
                                "response": `${uniqueIDName} : ${jsonData[uniqueIDName]}`
                            });

                        }

                        else {
                            callback(actionName, {
                                "result": RESULT_ERROR,
                                "response": "Validation error " + response1.response
                            })
                        }


                    });
                }
            }
        });


    }

    deleteFromDB(jsonData, collectionName, uniqueIDName, actionName, callback){

        mongoConnector.onMongoConnect(this.DBUrl, callback, (db) => {
            if (db) {

                const requiredSchema = {};
                requiredSchema[uniqueIDName] = Joi.required();
                const result = Joi.validate(jsonData, requiredSchema);

                if (result.error) callback(actionName, {"result": RESULT_BAD_DATA, "response": result.error.details[0].message});
                else {

                    let search_item = {};
                    search_item[uniqueIDName] = jsonData[uniqueIDName];

                    this.queryDB(collectionName, search_item, (request, response) => {

                        if (response.result === RESULT_OK){

                            db.db(this.DBName).collection(collectionName).remove(search_item, (err, res) => {
                                db.close();
                                if (err) callback(actionName, {
                                    "result": RESULT_ERROR,
                                    "response": "Deletion error: " + err
                                });
                                else callback(actionName, {"result": RESULT_OK, "response": res});
                            });

                        }

                        else if (response.result === RESULT_NO_SUCH_DATA){

                            callback(actionName, {
                                "result": RESULT_NO_SUCH_DATA,
                                "response": `${uniqueIDName} : ${jsonData[uniqueIDName]}`
                            });

                        }

                        else {
                            callback(actionName, {
                                "result": RESULT_ERROR,
                                "response": "Validation error " + response.response
                            })
                        }

                    });
                }
            }
        });

    }

    addDevice(jsonDeviceData, callback) {

        let requiredSchema = {};
        requiredSchema[KEY_DEVICE_NAME] = Joi.string().min(3).required();
        requiredSchema[KEY_DEVICE_ID] = Joi.string().min(3).required();

        this.addToDB(jsonDeviceData, requiredSchema, true, COLLECTION_NAME_DEVICE, KEY_DEVICE_ID, ACTION_DEVICE_CREATE, callback);
    }

    updateDevice(jsonDeviceData, callback) {
        const requiredSchema = {};
        requiredSchema[KEY_DEVICE_ID] = Joi.string().min(3);
        requiredSchema[KEY_DEVICE_NAME] = Joi.string().min(3);

        this.updateDB(jsonDeviceData, requiredSchema, true, COLLECTION_NAME_DEVICE, KEY_DEVICE_ID, ACTION_DEVICE_UPDATE, callback);
    }

    deleteDevice(jsonDeviceData, callback) {
        this.deleteFromDB(jsonDeviceData, COLLECTION_NAME_DEVICE, KEY_DEVICE_ID, ACTION_DEVICE_DELETE, callback);
    }

    addUnit(jsonUnitData, callback) {

        let search_item = {};
        let id = jsonUnitData[KEY_DEVICE_ID];
        if (id) search_item[KEY_DEVICE_ID] = id;
        this.queryDB(COLLECTION_NAME_DEVICE, search_item, (request, response) => {
            if (response.result === RESULT_OK){
                let requiredSchema = {};
                requiredSchema[KEY_UNIT_ID] = Joi.string().min(3).required();
                requiredSchema[KEY_DEVICE_ID] = Joi.string().min(3).required();
                requiredSchema[KEY_EMPLOYEE_REGISTRATION_ID] = Joi.any();
                jsonUnitData[KEY_EMPLOYEE_REGISTRATION_ID] = "none";
                this.addToDB(jsonUnitData, requiredSchema, false, COLLECTION_NAME_UNIT, KEY_UNIT_ID, ACTION_UNIT_CREATE, callback);
            }
            else {
                callback(ACTION_UNIT_CREATE, response)
            }

        });
    }

    updateUnit(jsonUnitData, callback){
        let search_device = {};
        let dID = jsonUnitData[KEY_CHANGES][KEY_DEVICE_ID];
        if (dID) search_device[KEY_DEVICE_ID] = dID;

        let requiredSchema = {};
        requiredSchema[KEY_UNIT_ID] = Joi.string().min(3);
        requiredSchema[KEY_DEVICE_ID] = Joi.string().min(3);
        requiredSchema[KEY_EMPLOYEE_REGISTRATION_ID] = Joi.string().min(3);

        this.queryDB(COLLECTION_NAME_DEVICE, search_device, (request, response) => {

            if (response.result === RESULT_OK){

                let eID = jsonUnitData[KEY_CHANGES][KEY_EMPLOYEE_REGISTRATION_ID];

                if (eID && eID !== "none"){

                    let search_emp = {};
                    search_emp[KEY_EMPLOYEE_ID] = eID;

                    this.queryDB(COLLECTION_NAME_EMPLOYEE, search_emp, (request, response) => {

                        if (response.result === RESULT_OK){
                            this.updateDB(jsonUnitData, requiredSchema, false, COLLECTION_NAME_UNIT, KEY_UNIT_ID, ACTION_UNIT_UPDATE, callback);
                        }
                        else {
                            callback(ACTION_UNIT_UPDATE, response)
                        }

                    })

                }
                else {
                    this.updateDB(jsonUnitData, requiredSchema, false, COLLECTION_NAME_UNIT, KEY_UNIT_ID, ACTION_UNIT_UPDATE, callback);
                }
            }
            else {
                callback(ACTION_UNIT_UPDATE, response)
            }

        });
    }

    deleteUnit(jsonUnitData, callback){
        this.deleteFromDB(jsonUnitData, COLLECTION_NAME_UNIT, KEY_UNIT_ID, ACTION_UNIT_DELETE, callback);
    }

    addEmployee(jsonEmployeeData, callback) {

        let requiredSchema = {};
        requiredSchema[KEY_EMPLOYEE_NAME] = Joi.string().min(3).required();
        requiredSchema[KEY_EMPLOYEE_ID] = Joi.string().min(3).required();
        requiredSchema[KEY_EMPLOYEE_EMAIL] = Joi.string().email().required();
        requiredSchema[KEY_EMPLOYEE_MOBILE] = Joi.number().integer().min(10).required();
        requiredSchema[KEY_EMPLOYEE_PASSWD] = Joi.string().min(6).required();
        requiredSchema[KEY_EMPLOYEE_ISADMIN] = Joi.boolean().required();

        this.addToDB(jsonEmployeeData, requiredSchema, true, COLLECTION_NAME_EMPLOYEE, KEY_EMPLOYEE_ID, ACTION_EMPLOYEE_CREATE, callback);
    }

    updateEmployee(jsonEmployeeData, callback) {
        const requiredSchema = {};
        requiredSchema[KEY_EMPLOYEE_NAME] = Joi.string().min(3);
        requiredSchema[KEY_EMPLOYEE_ID] = Joi.string().min(3);
        requiredSchema[KEY_EMPLOYEE_EMAIL] = Joi.string().email();
        requiredSchema[KEY_EMPLOYEE_MOBILE] = Joi.number().integer().min(10);
        requiredSchema[KEY_EMPLOYEE_PASSWD] = Joi.string().min(6);
        requiredSchema[KEY_EMPLOYEE_ISADMIN] = Joi.boolean();

        this.updateDB(jsonEmployeeData, requiredSchema, true, COLLECTION_NAME_EMPLOYEE, KEY_EMPLOYEE_ID, ACTION_EMPLOYEE_UPDATE, callback);
    }

    deleteEmployee(jsonEmployeeData, callback){
        this.deleteFromDB(jsonEmployeeData, COLLECTION_NAME_EMPLOYEE, KEY_EMPLOYEE_ID, ACTION_EMPLOYEE_DELETE, callback);
    }

}

module.exports.DBOperationClass = DBOperation;

module.exports.ACTION_DB_OPEN = ACTION_DB_OPEN;
module.exports.ACTION_QUERY_COMPLETE = ACTION_QUERY_COMPLETE;
module.exports.ACTION_DEVICE_CREATE = ACTION_DEVICE_CREATE;
module.exports.ACTION_DEVICE_UPDATE = ACTION_DEVICE_UPDATE;
module.exports.ACTION_DEVICE_DELETE = ACTION_DEVICE_DELETE;
module.exports.ACTION_UNIT_CREATE = ACTION_UNIT_CREATE;
module.exports.ACTION_UNIT_UPDATE = ACTION_UNIT_UPDATE;
module.exports.ACTION_UNIT_DELETE = ACTION_UNIT_DELETE;

module.exports.RESULT_OK = RESULT_OK;
module.exports.RESULT_ERROR = RESULT_ERROR;
module.exports.RESULT_BAD_DATA = RESULT_BAD_DATA;
module.exports.RESULT_NO_SUCH_DATA = RESULT_NO_SUCH_DATA;
module.exports.RESULT_DUPLICATE_ID = RESULT_DUPLICATE_ID;

module.exports.COLLECTION_NAME_DEVICE = COLLECTION_NAME_DEVICE;
module.exports.COLLECTION_NAME_UNIT = COLLECTION_NAME_UNIT;
module.exports.COLLECTION_NAME_EMPLOYEE = COLLECTION_NAME_EMPLOYEE;