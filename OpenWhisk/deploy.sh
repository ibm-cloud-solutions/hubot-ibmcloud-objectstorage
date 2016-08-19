#!/bin/bash
#
# Copyright 2016 IBM Corp. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the “License”);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#  https://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an “AS IS” BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
 
# Color vars to be used in shell script output
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'
 
# Validate config file exist and load configuration variables
if [ ! -f  ./env ]; then
    echo "env file does not exist!"
    exit 1
fi
source ./env

function usage() {
  echo -e "${YELLOW}Usage: $0 [--install,--uninstall,--reinstall,--env]${NC}"
}

function install() {
  echo -e "${YELLOW}Installing OpenWhisk actions for cloudbot object storage..."
  
  echo "Create action with configuration parameters..."
  wsk action create -t 300000\
    -p cloudantUsername $cloudantUsername\
    -p cloudantPassword $cloudantPassword\
    -p cloudantDbName $cloudantDbName\
    -p nlcUsername $nlcUsername\
    -p nlcPassword $nlcPassword\
    -p nlcUrl $nlcUrl\
    cloudbotNlcTrainerAction actions/nlcTrainer.js

  echo "Create cloudant feed trigger..."
  wsk trigger create --feed /whisk.system/cloudant/changes\
    -p host $cloudantHost\
    -p dbname $cloudantDbName\
    -p username $cloudantUsername\
    -p password $cloudantPassword\
    cloudbotNlcTrainerTrigger

  echo "Create rule to invoke action..."
  wsk rule create --enable cloudbotNlcTrainerRule\
    cloudbotNlcTrainerTrigger\
    cloudbotNlcTrainerAction

  echo -e "${GREEN}Install Complete${NC}"
  wsk list
}

function uninstall() {
  echo -e "${RED}Uninstalling..."
  
  echo "Removing actions..."
  wsk action delete cloudbotNlcTrainerAction
  
  echo "Removing trigger..."
  wsk trigger delete cloudbotNlcTrainerTrigger

  echo "Removing rule..."
  wsk rule delete cloudbotNlcTrainerRule

  echo -e "${GREEN}Uninstall Complete${NC}"
  wsk list
}

function showenv() {
  echo -e "${YELLOW}"
  echo cloudantHost=$cloudantHost
  echo cloudantDbName=$cloudantDbName
  echo cloudantUsername=$cloudantUsername
  echo cloudantPassword=$cloudantPassword
  echo nlcUsername=$nlcUsername
  echo nlcPassword=$nlcPassword
  echo nlcUrl=$nlcUrl
  echo -e "${NC}"
}

case "$1" in
"--install" )
install
;;
"--uninstall" )
uninstall
;;
"--reinstall" )
uninstall
install
;;
"--env" )
showenv
;;
* )
usage
;;
esac
