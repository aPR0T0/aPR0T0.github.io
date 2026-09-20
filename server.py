#!/usr/bin/env python3
"""Local motor-study server. Standard library only; bind loopback, validate all inputs.

The web client can request data-driven scene builds, never arbitrary Python/paths.
Uses the user's already-running Blender MCP on localhost:9876.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
import json
import math
import os
import re
import shutil
import socket
import subprocess
import threading
import time
import uuid

ROOT=Path(__file__).resolve().parent
DEFAULTS={'odMm':15,'motorLengthMm':20,'stackMm':12,'kv':1543,'outputRpm':150,
          'gearEfficiency':.75,'voltage':11.1,'cells':3,'torqueKgCm':1,'slots':12,
          'poles':14,'gapMm':.2,'phaseResistanceOhm':.42908444,'dutyPercent':100,
          'ratio':30,'thermalResistance':30,'otherLossW':1,'inverterEfficiency':.95,
          'fluxDensityT':.7,'slotAreaMm2':2,'fillFactor':.45,'windingFactor':.933,
          'meanTurnLengthMm':None,'ambientC':25,'maxWindingTempC':100,
          'windingTemperatureC':100,'resistanceMode':'winding',
          'motorType':'outrunner','wireDiameterMm':.24,'slotlessFluxDensityT':.35,
          'axialWindingThicknessMm':1.2,'axialFluxDensityT':.35}
BOUNDS={'odMm':(5,15),'motorLengthMm':(8,60),'stackMm':(.1,57),'kv':(20,20000),
        'outputRpm':(0,3000),'gearEfficiency':(.1,1),'voltage':(5,12.6),'cells':(2,3),
        'torqueKgCm':(0,30),'slots':(3,36),'poles':(2,48),'gapMm':(.03,.6),
        'eccentricityMm':(.05,1),'phaseResistanceOhm':(0,1000),'dutyPercent':(0,100),
        'ambientC':(-100,200),'thermalResistance':(0,1000),'motorEfficiency':(.1,1),
        'currentLimit':(.1,100),'batterySag':(0,.5),'fluxDensityT':(.1,1.5),
        'airgapFraction':(.4,.98),'phaseResistance':(.001,100),'rthKPerW':(.1,1000),
        'maxTempC':(40,200),'ratio':(6,100),'batteryVoltage':(5,12.6),
        'slotAreaMm2':(.001,1000),'fillFactor':(.001,1),'windingFactor':(.001,1),
        'meanTurnLengthMm':(.001,1000),'otherLossW':(0,10000),'inverterEfficiency':(.001,1),
        'maxWindingTempC':(-50,250),'windingTemperatureC':(-100,250),
        'wireDiameterMm':(.03,1),'slotlessFluxDensityT':(.05,1.2),
        'axialWindingThicknessMm':(.3,3),'axialFluxDensityT':(.05,1.2)}
ENUMS={'resistanceMode':{'winding','entered'},'motorType':{'outrunner','inrunner','frameless','slotless','axial'}}
JOBS={}
LOCK=threading.Lock()
SOCKET_LOCK=threading.Lock()
BLENDER_PORT=int(os.environ.get('BLDC_BLENDER_PORT','9876'))


def validate_config(raw):
    if not isinstance(raw,dict): raise ValueError('config must be an object')
    if len(raw)>64: raise ValueError('Too many configuration fields')
    result=dict(DEFAULTS)
    for key,value in raw.items():
        if key in ENUMS:
            if not isinstance(value,str) or value not in ENUMS[key]:
                raise ValueError(f'{key} must be one of: '+', '.join(sorted(ENUMS[key])))
            result[key]=value
            continue
        if key not in BOUNDS:
            # Ignore display-only, derived frontend values; never send their content to Blender.
            continue
        if key=='meanTurnLengthMm' and value is None:
            result[key]=None
            continue
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
            raise ValueError(f'{key} must be a finite number')
        low,high=BOUNDS[key]
        if not low<=value<=high: raise ValueError(f'{key} must be between {low} and {high}')
        result[key]=value
    for field in ('slots','poles','cells'):
        if int(result[field]) != result[field]: raise ValueError(field+' must be an integer')
        result[field]=int(result[field])
    if 'cells' in raw and 'voltage' not in raw:
        result['voltage']=3.7*result['cells']
    if not 2.5*result['cells']-1e-9<=result['voltage']<=4.2*result['cells']+1e-9:
        raise ValueError('Voltage must be between 2.5 and 4.2 V per selected cell')
    if result['poles']%2: raise ValueError('poles must be an even number')
    if result['slots']%3: raise ValueError('slots must be a multiple of three')
    if result['motorType']!='axial' and result['stackMm']>result['motorLengthMm']-3:
        raise ValueError('Active stack must leave at least 3 mm for bearings, end turns and caps')
    if result['motorType']!='axial' and result['gapMm']>result['odMm']*.08:
        raise ValueError('Air gap exceeds the radial geometry allowance')
    if result['thermalResistance']<=0:
        raise ValueError('thermalResistance must be greater than zero')
    if result['maxWindingTempC']<=result['ambientC']:
        raise ValueError('maxWindingTempC must exceed ambientC')
    if result['outputRpm']==0 and result['otherLossW']>0:
        raise ValueError('At zero speed, set rotational otherLossW to zero')
    return result


def validate_scene_geometry(config):
    # The calculator can preserve an infeasible study, but do not export
    # intersecting hardware as a finalized or live Blender construction.
    if config['motorType']=='axial':
        packet=2.88*(config['odMm']/15)+config['axialWindingThicknessMm']+config['gapMm']
        if packet+3>config['motorLengthMm']+1e-9:
            raise ValueError(f'Axial layers and 3 mm support allowance require at least {packet+3:.3f} mm body length')


def atomic_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    tmp.write_text(json.dumps(data,indent=2)+'\n')
    tmp.replace(path)


def blender_command(command,timeout=30):
    with SOCKET_LOCK:
        with socket.create_connection(('127.0.0.1',BLENDER_PORT),timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(json.dumps(command).encode())
            data=b''
            while len(data)<4*1024*1024:
                chunk=sock.recv(65536)
                if not chunk: break
                data+=chunk
                try: answer=json.loads(data.decode())
                except (UnicodeDecodeError,json.JSONDecodeError): continue
                if answer.get('status')=='error':
                    raise RuntimeError(answer.get('message','Blender command failed'))
                return answer.get('result',answer)
            raise RuntimeError('No complete response from Blender')


def blender_status():
    try:
        res=blender_command({'type':'execute_code','params':{'code':
            "import bpy,json\nprint(json.dumps({'version':bpy.app.version_string,'scene':bpy.context.scene.name,'file':bpy.data.filepath}))"}},timeout=3)
        info=json.loads(res.get('result','{}').strip())
        return {'connected':True,**info,'port':BLENDER_PORT}
    except Exception as exc:
        return {'connected':False,'port':BLENDER_PORT,'message':str(exc)}


def blender_executable():
    choices=[os.environ.get('BLDC_BLENDER_BIN',''),'/snap/blender/current/blender',shutil.which('blender') or '']
    for item in choices:
        if item and Path(item).is_file() and os.access(item,os.X_OK): return item
    return None


def sync_blender(config):
    # Fixed project-controlled source plus validated numerical data only.
    script=ROOT/'blender'/'scene_builder.py'
    scene_path=ROOT/'blender'/'motor_study.blend'
    code=("import importlib.util,json\n"
          f"spec=importlib.util.spec_from_file_location('bldc_scene_builder',{str(script)!r})\n"
          "module=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(module)\n"
          f"scene=module.build_motor(json.loads({json.dumps(config)!r}),preview=True)\n"
          f"module.save_scene_library(scene,{str(scene_path)!r})\n"
          "print(json.dumps({'scene':scene.name,'objects':len(scene.objects),'version':bpy.app.version_string}))")
    result=blender_command({'type':'execute_code','params':{'code':code}},timeout=90)
    info=json.loads(result.get('result','{}').strip().splitlines()[-1])
    return {'ok':True,'blender':{'connected':True,**info},'blend':'/blender/motor_study.blend','message':'Motor concept synchronized; use frames 1–60 to view the two-second explode.'}


def update_job(job_id,**values):
    with LOCK:
        JOBS[job_id].update(values)
        atomic_json(ROOT/'renders'/job_id/'job.json',JOBS[job_id])


def render_worker(job_id,config):
    out=ROOT/'renders'/job_id
    try:
        executable=blender_executable()
        if not executable: raise RuntimeError('Blender executable not found. Set BLDC_BLENDER_BIN before launching server.')
        if not shutil.which('ffmpeg'): raise RuntimeError('ffmpeg is needed to encode the two-second MP4.')
        update_job(job_id,status='rendering',progress=0,message='Building motor scene and rendering 60 frames at 1920 × 1920, 192 Cycles samples.')
        args=[executable,'--background','--factory-startup','-noaudio','--threads','8','--python',str(ROOT/'blender'/'scene_builder.py'),'--','--config',str(out/'config.json'),'--output',str(out),'--animation']
        with (out/'render.log').open('w') as log:
            process=subprocess.Popen(args,stdout=log,stderr=subprocess.STDOUT,cwd=ROOT)
            while process.poll() is None:
                count=len(list((out/'frames').glob('frame_*.png')))
                update_job(job_id,progress=round(count/60*95,1),message=f'Rendering frame {min(count+1,60)} of 60.')
                time.sleep(2)
            if process.returncode: raise RuntimeError(f'Blender exited with status {process.returncode}; see render.log.')
        frames=sorted((out/'frames').glob('frame_*.png'))
        if len(frames)!=60: raise RuntimeError(f'Expected 60 frames, found {len(frames)}.')
        update_job(job_id,status='encoding',progress=97,message='Encoding two-second MP4.')
        subprocess.run(['ffmpeg','-y','-framerate','30','-i',str(out/'frames'/'frame_%04d.png'),'-frames:v','60','-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'exploded_2s.mp4')],stdout=subprocess.DEVNULL,stderr=(out/'encode.log').open('w'),check=True)
        shutil.copy2(frames[-1],out/'exploded.png')
        artifacts={'video':f'/renders/{job_id}/exploded_2s.mp4','blend':f'/renders/{job_id}/motor_study.blend','still':f'/renders/{job_id}/exploded.png','config':f'/renders/{job_id}/config.json','frames':f'/renders/{job_id}/frames/','log':f'/renders/{job_id}/render.log'}
        update_job(job_id,status='completed',progress=100,message='Render complete: 60 frames at 30 fps = 2.00 seconds.',artifacts=artifacts)
    except Exception as exc:
        update_job(job_id,status='failed',message=str(exc),artifacts={'log':f'/renders/{job_id}/render.log'})


class Handler(SimpleHTTPRequestHandler):
    server_version='BLDCStudy/1.0'
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-store')
        self.send_header('Referrer-Policy','same-origin')
        super().end_headers()
    def valid_host(self):
        host=self.headers.get('Host','')
        return host in {f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'}
    def same_origin(self):
        origin=self.headers.get('Origin')
        return not origin or origin in {f'http://localhost:{self.server.server_port}',f'http://127.0.0.1:{self.server.server_port}'}
    def json_response(self,value,status=200):
        data=json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        if not self.valid_host(): return self.json_response({'error':'Invalid local Host'},403)
        path=urlsplit(self.path).path
        if path=='/':
            self.send_response(302)
            self.send_header('Location','/web/')
            self.end_headers()
            return
        if path=='/api/status':
            exe=blender_executable()
            return self.json_response({'ok':True,'blender':blender_status(),'renderer':{'available':bool(exe),'executable':exe},'ffmpegAvailable':bool(shutil.which('ffmpeg'))})
        if path=='/api/config':
            file=ROOT/'config'/'current.json'
            saved=json.loads(file.read_text()) if file.exists() else {}
            return self.json_response({'ok':True,'config':{**DEFAULTS,**saved}})
        if path.startswith('/api/jobs/'):
            job_id=path.split('/')[-1]
            with LOCK: job=JOBS.get(job_id)
            if not job and re.fullmatch(r'[a-f0-9]{12}',job_id):
                file=ROOT/'renders'/job_id/'job.json'
                if file.exists(): job=json.loads(file.read_text())
            return self.json_response(job if job else {'error':'Unknown render job'},200 if job else 404)
        if path.startswith('/api/'): return self.json_response({'error':'Unknown endpoint'},404)
        # Serve only public project assets, never hidden files/symlinks outside this root.
        target=(ROOT/unquote(path).lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or any(p.startswith('.') for p in target.relative_to(ROOT).parts):
            return self.json_response({'error':'Invalid path'},403)
        return super().do_GET()
    def do_POST(self):
        if not self.valid_host() or not self.same_origin(): return self.json_response({'error':'Only same-origin localhost requests are accepted'},403)
        if self.headers.get_content_type()!='application/json': return self.json_response({'error':'Use application/json'},415)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 1<=length<=32768: return self.json_response({'error':'Invalid request size'},413)
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict): raise ValueError('Request must be an object')
            config=validate_config(body.get('config',body))
            path=urlsplit(self.path).path
            if path=='/api/config':
                atomic_json(ROOT/'config'/'current.json',config)
                return self.json_response({'ok':True,'config':config,'path':'/config/current.json'})
            if path=='/api/blender/sync':
                validate_scene_geometry(config)
                atomic_json(ROOT/'config'/'current.json',config)
                return self.json_response(sync_blender(config))
            if path=='/api/render':
                if body.get('confirmed') is not True:
                    return self.json_response({'error':'Finalize the selected configuration before rendering; send confirmed:true.'},409)
                validate_scene_geometry(config)
                with LOCK:
                    active=[j for j in JOBS.values() if j['status'] in ('queued','rendering','encoding')]
                    if active: return self.json_response({'error':'A render is already in progress','jobId':active[0]['jobId']},409)
                    job_id=uuid.uuid4().hex[:12]
                    JOBS[job_id]={'jobId':job_id,'status':'queued','progress':0,'message':'Configuration finalized for rendering.','createdAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'artifacts':{}}
                out=ROOT/'renders'/job_id
                atomic_json(out/'config.json',config)
                atomic_json(ROOT/'config'/'finalized.json',config)
                threading.Thread(target=render_worker,args=(job_id,config),daemon=True).start()
                return self.json_response({'ok':True,'jobId':job_id,'status':'queued'},202)
            return self.json_response({'error':'Unknown endpoint'},404)
        except (ValueError,json.JSONDecodeError) as exc: return self.json_response({'error':str(exc)},400)
        except (OSError,RuntimeError) as exc: return self.json_response({'error':str(exc)},503)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default=os.environ.get('HOST','127.0.0.1'))
    parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','8787')))
    args=parser.parse_args()
    server=ThreadingHTTPServer((args.host,args.port),Handler)
    display_host='localhost' if args.host in ('127.0.0.1','localhost') else args.host
    print(f'Motor study: http://{display_host}:{args.port}   Blender: 127.0.0.1:{BLENDER_PORT}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
