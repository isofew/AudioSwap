#!/bin/bash

cd `dirname $0`

while true
do
    ./frida-inject -n com.nvidia.geforcenow:RemoteVideoProcess -s slCreateEngine.js
    sleep 1
done
