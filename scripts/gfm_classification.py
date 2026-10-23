"""Diagnostic labels only; never change the strict semantic comparison or pass flag."""
import re
from html import unescape

LABELS = {
    'container_parsing': '목록·인용문 컨테이너',
    'delimiter_matching': '강조 구분자 매칭',
    'bracket_reference_links': '괄호·링크·참조 정의',
    'autolinks': '자동 링크',
    'block_boundaries': '블록 경계·들여쓰기',
    'inline_text': '인라인 코드·이스케이프·개행',
    'html_policy_and_parsing': '원본 HTML 정책 또는 파싱',
    'url_policy': 'URL 허용 정책',
    'serialization_whitespace': '구조 주변 출력 공백',
    'other': '기타 구조 차이',
}
BLOCKS = {'p','ul','ol','li','blockquote','pre','table','hr','h1','h2','h3','h4','h5','h6'}

def formatting(tree):
    tag, attrs, children = tree
    block_children = any(isinstance(child, list) and child[0] in BLOCKS for child in children)
    return [tag,attrs,[formatting(child) if isinstance(child,list) else child for child in children
                       if not (block_children and isinstance(child,str) and not child.strip())]]

def first_difference(expected, actual, path='root'):
    if type(expected) is not type(actual):
        return {'path':path,'expected':str(expected)[:160],'actual':str(actual)[:160]}
    if isinstance(expected,list):
        for index,(left,right) in enumerate(zip(expected,actual)):
            if left != right: return first_difference(left,right,f'{path}/{index}')
        if len(expected)!=len(actual):return {'path':path,'expected_length':len(expected),'actual_length':len(actual)}
    elif expected!=actual:
        return {'path':path,'expected':str(expected)[:160],'actual':str(actual)[:160]}
    return None

def classify(item, expected=None, actual=None):
    source=item['markdown']; section=item['section']; wanted=item.get('expected_html',item.get('expected',''))
    signals=[]
    for url in re.findall(r'(?:href|src)=["\']([^"\']*)',wanted):
        url=unescape(url)
        if url.startswith('//') or re.match(r'^(?!https?:|mailto:)[a-zA-Z][a-zA-Z0-9+.-]*:',url):
            signals.append('expected URL is outside the current http/https/mailto policy')
    tags=re.findall(r'<\s*/?\s*([A-Za-z][A-Za-z0-9-]*)',source)
    allowed={'br','mark','sub','sup','ins','a','picture','source','img','details','summary'}
    if any(tag.lower() not in allowed for tag in tags):signals.append('source contains raw HTML outside the element allowlist')
    if expected is not None and actual is not None and formatting(expected)==formatting(actual):category='serialization_whitespace'
    elif signals and any('URL' in signal for signal in signals):category='url_policy'
    elif 'HTML' in section or signals:category='html_policy_and_parsing'
    elif section in ('List items','Lists','Block quotes','Task list items (extension)') or section=='Tabs':category='container_parsing'
    elif section=='Emphasis and strong emphasis':category='delimiter_matching'
    elif section in ('Links','Images','Link reference definitions'):category='bracket_reference_links'
    elif section.startswith('Autolinks'):category='autolinks'
    elif section in ('Code spans','Backslash escapes','Entity and numeric character references','Hard line breaks','Soft line breaks','Inlines'):category='inline_text'
    elif section in ('Precedence','Thematic breaks','ATX headings','Setext headings','Indented code blocks','Fenced code blocks','Paragraphs','Blank lines','Tables (extension)'):category='block_boundaries'
    else:category='other'
    return {'category':category,'label':LABELS[category], 'policy_signals':signals,
            'basis':'Diagnostic classification; a policy signal does not establish that every mismatch is intentional.'}
