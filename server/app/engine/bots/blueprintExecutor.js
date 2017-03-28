/*
 Copyright [2016] [Relevance Lab]

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var logger = require('_pr/logger')(module);
var async = require('async');
var usersDao = require('_pr/model/users.js');
var Blueprints = require('_pr/model/blueprint');

const errorType = 'blueprintExecutor';

var blueprintExecutor = module.exports = {};

blueprintExecutor.execute = function execute(botsDetails,auditTrail,reqBody,userName,callback) {
    async.waterfall([
        function (next) {
            usersDao.haspermission(reqBody.userName, reqBody.category, reqBody.permissionTo, null, reqBody.permissionSet,next);
        },
        function (launchPermission, next) {
            if(launchPermission === true){
                Blueprints.getById(reqBody.blueprintId,next);
            }else{
                logger.debug('No permission to ' + reqBody.permissionTo + ' on ' + reqBody.category);
                next({errCode:401,errMsg:'No permission to ' + reqBody.permissionTo + ' on ' + reqBody.category},null);
            }
        },
        function(blueprint,next){
            if(blueprint){
                var stackName = null,domainName = null,monitorId = null,blueprintLaunchCount = 0;
                if(blueprint.executionCount) {
                    blueprintLaunchCount = blueprint.executionCount + 1;
                }else{
                    blueprintLaunchCount = 1;
                }
                Blueprints.updateBlueprintExecutionCount(blueprint._id,blueprintLaunchCount,function(err,data){
                    if(err){
                        logger.error("Error while updating Blueprint Execution Count");
                    }
                });
                if (blueprint.blueprintType === 'aws_cf' || blueprint.blueprintType === 'azure_arm') {
                    stackName = reqBody.stackName;
                    if (!stackName) {
                        next({errCode:400,errMsg:"Invalid stack name"},null);
                    }
                }
                if(blueprint.domainNameCheck === true) {
                    domainName = reqBody.domainName;
                    if (!domainName) {
                        next({errCode:400,errMsg:"Invalid Domain name"},null);
                    }
                }
                if (reqBody.monitorId && reqBody.monitorId !== null && reqBody.monitorId !== 'null') {
                    monitorId = reqBody.monitorId;
                }
                Blueprints.launch({
                    envId: reqBody.envId,
                    ver: reqBody.version,
                    stackName: stackName,
                    domainName: domainName,
                    sessionUser: reqBody.userName,
                    tagServer: reqBody.tagServer,
                    monitorId: monitorId,
                    auditTrailId: auditTrail._id
                },next);

            }else{
                logger.debug("Blueprint Does Not Exist");
                next({errCode:404,errMsg:"Blueprint Does Not Exist"},null);
            }
        }
    ],function (err, results) {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, results);
        return;
    });
};
