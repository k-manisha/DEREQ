const exp = require('express');
const expApp = exp();
const DBOperation = require('./DBOperation');
const authenticator = require('./Authenticator');
const bcryptjs = require('bcryptjs');

const appPort = 2000;
const appUrl = "localhost";
const DBPort = 27017;
const DBName = "master_db";

const DBOpObj = new DBOperation.DBOperationClass(DBPort, appUrl, DBName);

expApp.use(exp.json());

const genericDBoperatinHandler = (request, response, res) => {
    if (response.result === DBOperation.RESULT_ERROR)
        res.status(500); //Internal error
    else if (response.result === DBOperation.RESULT_NO_SUCH_DATA)
        res.status(404); //Not found
    else if (response.result === DBOperation.RESULT_BAD_DATA)
        res.status(400); //Bad request
    else if (response.result === DBOperation.RESULT_DUPLICATE_ID)
        res.status(409); //Conflict
    res.send({"request" : request, "result" : response.result, "message" : response.response})
};

expApp.post('/query/device/', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.queryDB(DBOperation.COLLECTION_NAME_DEVICE, req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        }, true);
    });
});

expApp.post('/add/device', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.addDevice(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    }, true);
});

expApp.post('/update/device', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.updateDevice(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    }, true);
});

expApp.post('/delete/device', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.deleteDevice(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    }, true);
});

expApp.post('/query/unit/', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.queryDB(DBOperation.COLLECTION_NAME_UNIT, req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        }, true);
    })
});

expApp.post('/add/unit', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.addUnit(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    }, true);
});


expApp.post('/update/unit', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.updateUnit(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    }, true);
});

expApp.post('/delete/unit', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.deleteUnit(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    }, true);
});

expApp.post('/query/employee/', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.queryDB(DBOperation.COLLECTION_NAME_EMPLOYEE, req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        }, true);
    });
});

expApp.post('/add/employee', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.addEmployee(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    });
});


expApp.post('/update/employee', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.updateEmployee(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    });
});

expApp.post('/delete/employee', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.deleteEmployee(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    });
});

expApp.post('/unit/issue', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.issueUnit(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    });
});

expApp.post('/unit/submit', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.submitUnit(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        });
    });
});

expApp.post('/log/get', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.logger.getLog(req.body, (request, response) => {
            genericDBoperatinHandler(request, response, res);
        })
    }, true);
});

expApp.post('/log/clear', (req, res) => {
    authenticator.handleAuthorization(req, res, (tokenData) => {
        DBOpObj.logger.clearLog((request, response) => {
            genericDBoperatinHandler(request, response, res);
        })
    }, true);
});

expApp.post('/login', (req, res) => {

    let eid = req.body[DBOperation.KEY_EMPLOYEE_ID];
    let passwd = req.body[DBOperation.KEY_EMPLOYEE_PASSWD];
    if (!passwd) passwd = "";

    let query = {};
    query[DBOperation.KEY_EMPLOYEE_ID] = eid;

    DBOpObj.queryDB(DBOperation.COLLECTION_NAME_EMPLOYEE, query, (request, response) => {

        if (response.result === DBOperation.RESULT_OK){

            if (response.response[0][DBOperation.KEY_EMPLOYEE_ISACTIVE]) {
                bcryptjs.compare(passwd, response.response[0][DBOperation.KEY_EMPLOYEE_PASSWD], (err, isMatch) => {

                    if (isMatch) {
                        let isActive = response.response[0][DBOperation.KEY_EMPLOYEE_ISACTIVE];
                        let isAdmin = response.response[0][DBOperation.KEY_EMPLOYEE_ISADMIN];

                        if (isActive) {

                            authenticator.generateToken(eid, isAdmin, (token) => {
                                res.json({
                                    token
                                });
                            })

                        }
                    }
                    else {
                        res.status(401).send("Wrong password");
                    }
                });
            }
            else {
                res.status(401).send("Inactive account");
            }

        }
        else if (response.result === DBOperation.RESULT_ERROR) {
            res.status(500).send("Login token generation error");
        }
        else {
            res.status(404).send("Account not found");
        }
    });
});

expApp.listen(appPort, () => {
    console.log("Listening...");
});