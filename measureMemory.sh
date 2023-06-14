#!/bin/sh
if [ $# -eq 0 ]; then
    echo "Specify PID as argument"
    exit 1
fi
rm -rf ./.memory_measure_venv
python -m venv ./.memory_measure_venv
source ./.memory_measure_venv/bin/activate
pip install ps_mem
ps_mem -p $1 -w 5 -t >./memoryFrontend/measurements.txt &
python3 -m http.server --directory ./memoryFrontend
rm -rf ./.memory_measure_venv
