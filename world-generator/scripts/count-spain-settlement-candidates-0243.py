#!/usr/bin/env python3
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'world-generator'/'.cache'/'geonames'
URL='https://download.geonames.org/export/dump/cities5000.zip'
ALLOWED={'PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC'}


def download():
    CACHE.mkdir(parents=True,exist_ok=True)
    target=CACHE/'cities5000.zip'
    if target.exists() and target.stat().st_size>1_000_000:return target
    req=urllib.request.Request(URL,headers={'User-Agent':'WAFT-world-generator/0.24.3'})
    with urllib.request.urlopen(req,timeout=60) as response:target.write_bytes(response.read())
    return target


def read_rows(path):
    with zipfile.ZipFile(path) as archive:
        name=next(n for n in archive.namelist() if n.endswith('.txt'))
        text=archive.read(name).decode('utf-8')
    rows=[]
    for line in text.splitlines():
        f=line.split('\t')
        if len(f)<19 or f[8]!='ES' or f[6]!='P' or f[7] not in ALLOWED:continue
        try:pop=int(f[14] or '0');lat=float(f[4]);lon=float(f[5])
        except ValueError:continue
        if pop<10_000:continue
        # Same mainland scope as the current 20k navigation markers.
        if lat<36.0 or lat>43.8 or lon<-9.6 or lon>3.35:continue
        if lon>1.0 and lat<40.3:continue
        rows.append({'id':f[0],'name':f[1],'lat':lat,'lon':lon,'population':pop})
    seen=set();dedup=[]
    for item in sorted(rows,key=lambda x:(-x['population'],x['name'].casefold(),x['id'])):
        key=(item['name'].casefold(),round(item['lat'],2),round(item['lon'],2))
        if key in seen:continue
        seen.add(key);dedup.append(item)
    return dedup


def main():
    rows=read_rows(download())
    ranges={'10k-19k':0,'20k-49k':0,'50k-199k':0,'200k+':0}
    for item in rows:
        p=item['population']
        if p<20_000:ranges['10k-19k']+=1
        elif p<50_000:ranges['20k-49k']+=1
        elif p<200_000:ranges['50k-199k']+=1
        else:ranges['200k+']+=1
    current=sum(v for k,v in ranges.items() if k!='10k-19k')
    print('WAFT_10K_CANDIDATES '+json.dumps({'minimumPopulation':10000,'total':len(rows),'current20kEquivalent':current,'additional10kTo19k':ranges['10k-19k'],'ranges':ranges},ensure_ascii=False,sort_keys=True))

if __name__=='__main__':main()
