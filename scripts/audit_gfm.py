"""Audit every official GFM example against the editor renderer, without dependencies.
Editor-only wrappers/attributes are ignored; semantic structure and text are compared.
Failures are reported, never relabeled as full conformance.
"""
from pathlib import Path
from html.parser import HTMLParser
import re,struct,subprocess,json,hashlib,sys
from gfm_classification import LABELS, classify, first_difference
root=Path(__file__).resolve().parents[1]
spec=(root/'tests/fixtures/gfm-spec.txt').read_text()
examples=[];section='';lines=spec.splitlines(keepends=True);index=0
while index<len(lines):
    if lines[index].startswith('#'): section=lines[index].lstrip('#').strip()
    if re.match(r'^`{32} example',lines[index]):
        start=index+1;index=start
        while lines[index].strip()!='.':index+=1
        markdown=''.join(lines[start:index]).replace('→','\t');index+=1;start=index
        while not re.match(r'^`{32}\s*$',lines[index]):index+=1
        examples.append({'number':len(examples)+1,'section':section,'markdown':markdown,'expected':''.join(lines[start:index]).replace('→','\t')})
    index+=1
class Tree(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True);self.root=['root',[],[]];self.stack=[self.root];self.tags=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs);skip=tag in ('span','section','thead','tbody') or (tag=='div' and attrs.get('class')=='table_scroll')
        if skip: self.tags.append((tag,False));return
        keep=sorted((k,v or '') for k,v in attrs.items() if k in ('href','src','alt','title','start','type','checked','disabled','align') and not (k=='align' and v=='left'))
        # CSS align is equivalent to the HTML align attribute used by the spec.
        for align in ('center','right'):
            if 'align_'+align in attrs.get('class','').split():keep.append(('align',align))
        node=[tag,sorted(keep),[]];self.stack[-1][2].append(node)
        if tag not in ('br','hr','img','input','source','wbr'): self.stack.append(node);self.tags.append((tag,True))
    def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs)
    def handle_endtag(self,tag):
        for index in range(len(self.tags)-1,-1,-1):
            if self.tags[index][0]==tag:
                for _,pushed in self.tags[index:]:
                    if pushed and len(self.stack)>1:self.stack.pop()
                del self.tags[index:];break
    def handle_data(self,data):self.stack[-1][2].append(data)
def canonical(html):
    html=re.sub(r'<section data-block="1" data-start="(\d+)" data-end="\1"><p><br></p></section>','',html)
    tree=Tree();tree.feed(html)
    def clean(node):
        tag,attrs,children=node;result=[]
        for child in children:
            if isinstance(child,str):
                if tag in ('root','ul','ol','table','thead','tbody','tr','blockquote') and not child.strip():continue
                if result and isinstance(result[-1],str): result[-1]+=child
                else:result.append(child)
            else:
                value=clean(child)
                if value[0]=='p' and not value[2]:continue
                result.append(value)
        return [tag,attrs,result]
    return clean(tree.root)
subprocess.run(['cargo','build','--offline','--example','render_gfm'],cwd=root,check=True)
wire=b''.join(struct.pack('<I',len(item['markdown'].encode()))+item['markdown'].encode() for item in examples)
process=subprocess.run([str(root/'target/debug/examples/render_gfm')],input=wire,stdout=subprocess.PIPE,cwd=root,check=True)
cursor=0;sections={};passed=0;details=[]
for item in examples:
    length=struct.unpack('<I',process.stdout[cursor:cursor+4])[0];cursor+=4;html=process.stdout[cursor:cursor+length].decode();cursor+=length
    expected_tree=canonical(item['expected']);actual_tree=canonical(html)
    match=expected_tree==actual_tree;passed+=match
    stats=sections.setdefault(item['section'],{'total':0,'passed':0});stats['total']+=1;stats['passed']+=match
    details.append({'example':item['number'],'section':item['section'],'passed':match,'markdown':item['markdown'],'expected_html':item['expected'],'actual_html':html, 'classification':None if match else classify(item,expected_tree,actual_tree), 'difference':None if match else first_difference(expected_tree,actual_tree)})
report={'spec':'GFM 0.29-gfm','source':'https://github.com/github/cmark-gfm/blob/master/test/spec.txt','sha256':hashlib.sha256(spec.encode()).hexdigest(),'examples':len(examples),'passed':passed,'failed':len(examples)-passed,'comparison':'Semantic HTML tree; editor wrappers/classes/empty caret placeholders removed; optional thead/tbody and default left alignment normalized; safe URL/HTML policy remains active. Not a GFM conformance certificate.','sections':sections}
categories={key:{'label':label,'remaining':0} for key,label in LABELS.items()}
for item in details:
    if not item['passed']:categories[item['classification']['category']]['remaining']+=1
classification_baseline=json.loads((root/'tests/fixtures/gfm-classification-baseline.json').read_text())
assert classification_baseline['spec_sha256']==report['sha256'], 'Classification baseline fixture changed'
matched={item['example'] for item in details if item['passed']}
original=classification_baseline['failed_examples']
resolved=[item['example'] for item in original if item['example'] in matched]
remaining_original=[item['example'] for item in original if item['example'] not in matched]
regressed=sorted(set(classification_baseline['passed_examples'])-matched)
classification={'starting_passed':len(classification_baseline['passed_examples']), 'starting_failed':len(original), 'current_passed':passed,'current_failed':len(details)-passed,'resolved_examples':resolved,'remaining_starting_examples':remaining_original,'regressed_examples':regressed,'categories':categories,'examples':[{'example':item['example'],'section':item['section'],'classification':item['classification'],'difference':item['difference']} for item in details if not item['passed']]}
assert sum(item['remaining'] for item in categories.values())==report['failed']
assert len(original)+len(classification_baseline['passed_examples'])==len(details)
report['classification']={key:value for key,value in classification.items() if key not in ('examples','remaining_starting_examples','resolved_examples','regressed_examples')}
(root/'docs/gfm-classification.json').write_text(json.dumps(classification,ensure_ascii=False,indent=2)+'\n')
(root/'docs/gfm-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(root/'web/gfm-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(root/'web/gfm-results.json').write_text(json.dumps(details,ensure_ascii=False)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2) if '--verbose' in sys.argv else f"GFM semantic audit: {passed}/{len(examples)} matched; {len(examples)-passed} mismatches recorded in docs/gfm-audit.json and web/gfm-results.json.")

baseline_path=root/'tests/fixtures/gfm-baseline.json'
if '--update-baseline' in sys.argv:
    baseline_path.write_text(json.dumps({'spec_sha256':report['sha256'],'passed_examples':[item['example'] for item in details if item['passed']]},indent=2)+'\n')
if '--check' in sys.argv:
    baseline=json.loads(baseline_path.read_text());regressed=sorted(set(baseline['passed_examples'])-{item['example'] for item in details if item['passed']})
    if baseline['spec_sha256']!=report['sha256'] or regressed:
        print('GFM regression or changed fixture:',regressed,file=sys.stderr);sys.exit(1)
    print('GFM baseline regression guard passed; known mismatches remain reported.')
