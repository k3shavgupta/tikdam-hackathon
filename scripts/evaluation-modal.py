"""Private synthetic evaluation. No credentials are passed into the function."""
import base64, json, re, struct, sys, time
import modal
import signal
def interrupt(signum,frame): raise KeyboardInterrupt()
signal.signal(signal.SIGTERM,interrupt)

app = modal.App('tikdam-evaluation-document-metadata')

@app.function(image=modal.Image.debian_slim(python_version='3.12'), cpu=(0.125,0.25), memory=(128,256), timeout=15, startup_timeout=30, retries=0, max_containers=1, min_containers=0, buffer_containers=0, scaledown_window=2, block_network=True, single_use_containers=True, include_source=False, serialized=True)
def document_metadata(documents):
    import base64, re, struct
    output=[]
    for item in documents:
        data=base64.b64decode(item['data'],validate=True)
        if len(data)>1024*1024: raise ValueError('Synthetic fixture exceeds test bound')
        if data.startswith(b'%PDF-'):
            # Scope: generated uncompressed native PDFs only, not a full PDF parser.
            pages=len(re.findall(rb'/Type\s*/Page\b',data))
            output.append({'id':item['id'],'type':'pdf','pages':pages,'allowed':1<=pages<=10})
        elif data.startswith(b'\x89PNG\r\n\x1a\n') and len(data)>=33:
            width,height=struct.unpack('>II',data[16:24])
            output.append({'id':item['id'],'type':'png','width':width,'height':height,'allowed':width>0 and height>0})
        else: output.append({'id':item['id'],'type':'unsupported','allowed':False})
    return output

def main():
    mode=sys.argv[1] if len(sys.argv)>1 else 'metadata'
    if mode=='metadata':
        # from_env only opens SDK stubs; hello performs the authenticated RPC.
        client=modal.Client.from_env()
        client.hello()
        print(json.dumps({'authenticated':True,'sdkVersion':modal.__version__}))
        return
    documents=json.load(sys.stdin)
    started=time.monotonic();app_id=None;stopped=False;result=None
    with app.run(detach=False) as running:
        app_id=running.app_id
        print(json.dumps({'event':'app_started','appId':app_id}),file=sys.stderr,flush=True)
        try:
            result=document_metadata.remote(documents)
        finally:
            app.stop()
            stopped=True
    print(json.dumps({'appId':app_id,'results':result,'explicitStopRequested':stopped,'ephemeralContextExited':True,'wallSeconds':round(time.monotonic()-started,3),'billingVerified':False}))
if __name__=='__main__':main()
