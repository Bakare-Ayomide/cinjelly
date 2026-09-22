with open('src/components/AdminDashboard.tsx', 'r') as f:
    text = f.read()

target = """      {/* ALL MODALS PRESERVED INTACT */}
      </main>"""

replace = """      {/* ALL MODALS PRESERVED INTACT */}"""

text = text.replace(target, replace)

with open('src/components/AdminDashboard.tsx', 'w') as f:
    f.write(text)

print("Fixed stray </main> in AdminDashboard.tsx!")
