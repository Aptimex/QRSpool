#!/usr/bin/env python3

# This parses the print profile definitions from the BambuStudio repo to extract the latest type-to-code mappings. 
# You must first clone/download the repo (https://github.com/bambulab/BambuStudio) to a local folder so this script can parse the files in it. 

import sys
import shutil
import os
from os.path import isfile, join
import json

def usage():
    print("First argument must be path to the /resources/profiles/BBL/filament folder in a local BambuStudio repo")

def main():
    if len(sys.argv) < 2:
        usage()
        return None

    pDir = sys.argv[1]
    profiles = [f for f in os.listdir(pDir) if isfile(join(pDir, f))]
    baseProfiles = []
    codes = {}

    for f in profiles:
        pf = join(pDir, f)
        if "@base" in f:
            baseProfiles.append(pf)
            
    if len(baseProfiles) == 0:
        print(f"No print profile files found in {pDir}, please check the path")
        usage()
        return None
    #print(baseProfiles)
    
    for p in baseProfiles:
        with open(p, "r") as f:
            info = json.loads(f.read())
            name = info["name"].split(" @")[0]
            fid = info["filament_id"]
            codes[name] = fid
    
    print(json.dumps(codes, indent="\t"))
    return codes

if __name__ == '__main__':
    main()
