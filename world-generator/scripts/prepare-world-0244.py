#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'world-generator'/'configs'/'iberia.region.json'

def stable(value): return json.dumps(value,ensure_ascii=False,sort_keys=False,indent=2)+'\n'

def ensure_by_id(items,value):
    for i,item in enumerate(items):
        if item.get('id')==value['id']:
            items[i]=value;return
    items.append(value)

def main():
    data=json.loads(CONFIG.read_text('utf-8'))
    data['version']='0.24.4'
    # Keep the proven horizontal scale and grid; only extend the southern envelope enough to include Melilla.
    data['geography']['bounds']['south']=35.15
    for item in [
        {'id':'gibraltar','name':'Gibraltar','type':'mountain','center':{'lon':-5.35,'lat':36.14},'priority':99},
        {'id':'ceuta','name':'Ceuta','type':'coast','center':{'lon':-5.32042,'lat':35.88919},'priority':98},
        {'id':'melilla','name':'Melilla','type':'coast','center':{'lon':-2.93833,'lat':35.29369},'priority':98}
    ]: ensure_by_id(data['geography']['subregions'],item)
    for item in [
        {'id':'pyrenees-france','name':'Frontera pirenaica · Francia','position':{'lon':0.55,'lat':43.35},'type':'land_border','arrivalHeadingDegrees':0},
        {'id':'atlantic-canarias','name':'Corredor Atlántico · Canarias','position':{'lon':-7.2,'lat':36.0},'type':'air','arrivalHeadingDegrees':210}
    ]: ensure_by_id(data['travel']['entryPoints'],item)
    for item in [
        {'id':'iberia-france-continuous','targetRegionId':'france','entryPointId':'pyrenees-france','requiredCapabilities':['land'],'distanceClass':'regional','enabled':True},
        {'id':'iberia-canarias-continuous','targetRegionId':'canarias','entryPointId':'atlantic-canarias','requiredCapabilities':['long_water'],'distanceClass':'long','enabled':True}
    ]: ensure_by_id(data['travel']['connections'],item)
    CONFIG.write_text(stable(data),'utf-8')
    print(json.dumps({'region':'iberia','version':data['version'],'south':data['geography']['bounds']['south'],'connections':[x['id'] for x in data['travel']['connections']]},ensure_ascii=False))

if __name__=='__main__': main()
