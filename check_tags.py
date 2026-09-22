with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

tabs = ['overview', 'subscription', 'direct_debit', 'requests', 'affiliate', 'apps', 'support', 'account']

for t in tabs:
    marker = f"{{activeTab === '{t}' && ("
    pos = text.find(marker)
    if pos == -1:
        print(f"Tab {t} NOT FOUND")
        continue
    # find next tab or </main>
    next_pos = -1
    for next_t in tabs:
        if next_t == t: continue
        p = text.find(f"{{activeTab === '{next_t}' && (", pos)
        if p != -1 and (next_pos == -1 or p < next_pos):
            next_pos = p
    if next_pos == -1:
        next_pos = text.find('</main>', pos)
    
    chunk = text[pos:next_pos]
    div_open = chunk.count('<div')
    div_close = chunk.count('</div>')
    paren_open = chunk.count('(')
    paren_close = chunk.count(')')
    print(f"Tab {t:15}: open_divs={div_open}, close_divs={div_close}, diff={div_open - div_close} | open_parens={paren_open}, close_parens={paren_close}, diff={paren_open - paren_close}")
