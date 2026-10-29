"""Fill the supplied Word template and render its content as an editable DOCX + PDF.
Run from the repository root. --pdf-only preserves any manual Word edits.
PDF uses ReportLab rather than claiming a pixel-identical Microsoft Word conversion.
"""
from pathlib import Path
from copy import deepcopy
from io import BytesIO
from html import escape
import re
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph as WordParagraph
from docx.table import Table as WordTable
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / 'FullName_RegNo_WT_ProjectReport_ICT3131.docx'
OUTPUT = ROOT / 'docs/CampusConnect_Project_Report.docx'
PDF = OUTPUT.with_suffix('.pdf')

REFERENCES = [
    ('React, Thinking in React', 'https://github.com/reactjs/react.dev/blob/main/src/content/learn/thinking-in-react.md'),
    ('Vite, Getting Started', 'https://github.com/vitejs/vite/blob/main/docs/guide/index.md'),
    ('Tailwind CSS, official README', 'https://github.com/tailwindlabs/tailwindcss/blob/main/README.md'),
    ('Express, official README', 'https://github.com/expressjs/express/blob/master/Readme.md'),
    ('Node.js 24, SQLite API', 'https://nodejs.org/docs/latest-v24.x/api/sqlite.html'),
    ('bcrypt, official README', 'https://github.com/kelektiv/node.bcrypt.js/blob/master/README.md'),
    ('Playwright, Writing tests', 'https://github.com/microsoft/playwright/blob/main/docs/src/writing-tests-js.md'),
]

def insert_after(paragraph, text='', style=None):
    node = OxmlElement('w:p')
    paragraph._p.addnext(node)
    new = WordParagraph(node, paragraph._parent)
    if style:
        new.style = style
    if text:
        new.add_run(text)
    return new


def build_word():
    doc = Document(TEMPLATE)
    paragraphs = list(doc.paragraphs)
    normal = doc.styles['Normal']
    normal.font.name = 'Times New Roman'
    normal.font.size = Pt(11)
    normal.paragraph_format.line_spacing = 1.12
    normal.paragraph_format.space_after = Pt(7)
    for name, size in [('Heading 1', 16), ('Heading 2', 13), ('Caption', 10)]:
        if name not in doc.styles:
            doc.styles.add_style(name, 1)
        doc.styles[name].font.name = 'Times New Roman'
        doc.styles[name].font.size = Pt(size)
        doc.styles[name].font.color.rgb = RGBColor.from_string('253D36')
        doc.styles[name].paragraph_format.keep_with_next = True
        doc.styles[name].paragraph_format.space_before = Pt(14)
        doc.styles[name].paragraph_format.space_after = Pt(8)
    if 'Code Snippet' not in doc.styles:
        doc.styles.add_style('Code Snippet', 1)
    doc.styles['Code Snippet'].font.name = 'Courier New'
    doc.styles['Code Snippet'].font.size = Pt(9)
    doc.styles['Code Snippet'].paragraph_format.line_spacing = 1
    doc.styles['Code Snippet'].paragraph_format.keep_together = True
    for p in paragraphs:
        f = p.paragraph_format
        f.left_indent = Inches(0)
        f.right_indent = Inches(0)
        f.first_line_indent = Inches(0)
        f.line_spacing = 1.12
        f.space_before = Pt(0)
        f.space_after = Pt(7)
        f.page_break_before = False
        f.widow_control = True
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT

    def put(index, text, style='Normal'):
        p = paragraphs[index]
        p.text = text
        p.style = style
        for run in p.runs:
            run.font.name = 'Times New Roman' if style != 'Code Snippet' else 'Courier New'
            run.font.size = Pt(11 if style == 'Normal' else 8 if style == 'Code Snippet' else 16 if style == 'Heading 1' else 13)
            run.font.italic = False
            run.font.bold = style.startswith('Heading')
            run.font.color.rgb = RGBColor.from_string('253D36' if style.startswith('Heading') else '202020')
        return p

    # Keep the template's images, but turn floating anchors into inline images to avoid overlap.
    for index, width in [(11, 1.25), (31, 5.9)]:
        p = paragraphs[index]
        for anchor in p._p.xpath('.//*[local-name()="anchor"]'):
            inline = OxmlElement('wp:inline')
            for tag in ['extent', 'effectExtent', 'docPr', 'cNvGraphicFramePr']:
                node = anchor.find(qn(f'wp:{tag}'))
                if node is not None:
                    inline.append(deepcopy(node))
            inline.append(deepcopy(anchor.find(qn('a:graphic'))))
            extent = inline.find(qn('wp:extent'))
            ratio = int(extent.get('cy')) / int(extent.get('cx'))
            extent.set('cx', str(int(Inches(width))))
            extent.set('cy', str(int(Inches(width * ratio))))
            graphic_extent = inline.xpath('.//*[local-name()="xfrm"]/*[local-name()="ext"]')
            for e in graphic_extent:
                e.set('cx', extent.get('cx')); e.set('cy', extent.get('cy'))
            anchor.getparent().replace(anchor, inline)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    put(2, 'CampusConnect\nCampus Event and Club Management Portal')
    put(6, 'WEB TECHNOLOGY PROJECT REPORT\nV SEMESTER BTech [PROGRAMME NAME]')
    put(7, 'FLEXICORE-3131')
    put(9, 'SUBMITTED TO')
    put(10, 'SCHOOL OF COMPUTER ENGINEERING\nM.I.T., MANIPAL')
    put(20, 'By')
    put(21, '[STUDENT 1 NAME]\nRegistration No. [STUDENT 1 REGISTRATION NUMBER]')
    put(22, '[STUDENT 2 NAME]\nRegistration No. [STUDENT 2 REGISTRATION NUMBER]')
    put(24, 'Under the guidance of: [FACULTY NAME]')
    put(25, '[SUBMISSION MONTH AND YEAR]')
    for i in [2, 6, 7, 9, 10, 20, 21, 22, 24, 25]:
        p = paragraphs[i]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(12)
        for r in p.runs:
            r.font.size = Pt(18 if i == 2 else 12 if i in [6, 7, 10] else 11)
            r.font.bold = i in [2, 6, 7, 10]
    paragraphs[2].paragraph_format.space_before = Pt(12)
    paragraphs[11].paragraph_format.space_after = Pt(14)
    paragraphs[31].paragraph_format.space_before = Pt(16)

    put(32, 'Team Details and Work Split', 'Heading 1').paragraph_format.page_break_before = True
    table = doc.tables[0]
    rows = [
        ['Sl.', 'Name', 'Reg. No.', 'Two primary assigned modules', 'Signature'],
        ['1', '[STUDENT 1 NAME]', '[STUDENT 1 REGISTRATION NUMBER]', '1. Authentication & Student Dashboard\n2. Event Discovery & Registration', '[SIGNATURE 1]'],
        ['2', '[STUDENT 2 NAME]', '[STUDENT 2 REGISTRATION NUMBER]', '1. Organizer Event Management\n2. Organizer Dashboard & Attendees', '[SIGNATURE 2]'],
    ]
    for row, values in zip(table.rows, rows):
        for cell, value in zip(row.cells, values):
            cell.text = value
    table.autofit = False
    for row in table.rows:
        for cell, width in zip(row.cells, [.3, 1.05, 1.05, 2.6, 1.25]):
            cell.width = Inches(width)
    put(34, 'Allocation note: these are assigned review, maintenance and demonstration responsibilities, not a claim of individual implementation history. The initial application and report were generated with Codex assistance. Both students must review, adapt and acknowledge their actual contributions. Shared work: architecture, schema, API integration, common design, integration testing, documentation and final report review.')
    put(35, '1. Project Overview', 'Heading 1')
    put(36, 'CampusConnect is a working campus event portal with a React interface, Express REST backend and persistent SQLite database. Students create accounts, discover events, reserve one seat and manage their own registrations. Organizers create and maintain their own events and view confirmed attendees. Six focused features demonstrate the complete browser-to-database flow without external services.')
    put(37, '1.1 Purpose of the Website', 'Heading 2')
    put(38, 'The portal gives fictional campus events one searchable home. It helps a student find an activity, understand its time and venue, and confirm a place. A personal dashboard makes cancellation clear. Organizers maintain accurate information and check who is attending. The project is intended for a reliable classroom demonstration rather than a public institutional deployment.')
    put(39, '1.2 Objectives', 'Heading 2')
    put(40, '1. Student registration, login and logout.\n2. Database-driven event discovery with search and category filters.\n3. Event details and capacity-safe registration.\n4. Private student dashboard and cancellation.\n5. Authorized organizer event creation, editing and deletion.\n6. Organizer statistics and private confirmed-attendee lists.')
    put(41, '1.3 Target Users', 'Heading 2')
    put(42, 'Students use discovery and personal registrations; authorized organizers manage events. Mobile users receive responsive cards and forms. Semantic landmarks, explicit labels, keyboard-accessible links and buttons, visible focus, a skip link, reduced-motion support and announced error/status messages improve accessibility. No formal WCAG certification or assistive-technology audit is claimed.')
    put(43, '1.4 Site Map', 'Heading 2')
    put(44, '/ (Discovery, Student 1) → /events/:id (Details and registration, Student 1)\n/signup and /login (Student 1) → /dashboard (My registrations, Student 1)\nOrganizer login → /organizer (Studio and statistics, Student 2)\n/organizer → /organizer/new and /organizer/events/:id/edit (Student 2)\n/organizer → /organizer/events/:id/attendees (Student 2)')
    put(45, 'Both roles share the header, discovery pages and footer. Navigation exposes the relevant dashboard after login; the backend independently enforces permissions.')
    put(46, 'The interactive Mermaid sitemap and relational diagram are included in README.md. Responsibility labels describe the assigned demonstration split above.')
    put(47, '1.5 Tools and Technologies', 'Heading 2')
    tech = doc.tables[1]
    tech_values = [
        ('HTML version', 'HTML5 semantic landmarks and forms'),
        ('CSS framework and version', 'Tailwind CSS 4.1.16 plus shared responsive CSS [3]'),
        ('JavaScript (if any)', 'JavaScript ES modules; React 19.1.1, Vite 7.3.7, Express 5.1.0 [1, 2, 4]'),
        ('Data source (static / JSON / API)', 'SQLite through Node 24 node:sqlite; JSON REST API [5]'),
        ('IDE and Environment used', 'Codex cloud workspace, Linux, Node 24.19.0, npm 11.9.0, Git'),
        ('Accessibility Guidelines for Users with Disabilities.', 'Semantic structure, explicit labels, visible focus, responsive layout; no certification claimed'),
        ('Testing tools (Lighthouse, WAVE etc.)', 'ESLint; Node HTTP integration tests; Playwright with Chromium [7]. Lighthouse/WAVE not run.'),
    ]
    for row, (name, value) in zip(tech.rows[1:], tech_values):
        row.cells[0].text = name
        row.cells[1].text = value
    put(49, '1.5 Common Design Followed by the Team', 'Heading 2')
    put(50, 'A forest-green, sage and warm-neutral palette gives every page the same identity. A shared header contains the brand and role-aware navigation; main content uses restrained headings, cards and forms; the footer identifies the learning project. System typography avoids external font requests. Local SVG illustrations identify event categories. Buttons, badges, tables, loading, empty, success and error states share reusable components. Layouts adapt to mobile without relying on remote assets.')

    put(51, '2. Student 1: [STUDENT 1 NAME] (Reg. No: [STUDENT 1 REGISTRATION NUMBER])', 'Heading 1').paragraph_format.page_break_before = True
    put(52, 'Assigned modules: Authentication & Student Dashboard; Event Discovery & Registration.')
    put(53, '2.1 Module Description', 'Heading 2')
    put(54, 'Authentication & Student Dashboard: signup and login forms validate input, show useful errors, and open a protected personal page. The dashboard displays confirmed/cancelled registrations and permits cancellation before an event starts. Event Discovery & Registration: responsive event cards load from SQLite through the API; search and category buttons narrow the results. Details show the host, date, local time, venue and remaining seats, with a working registration action.')
    put(55, 'Input is a form, search value or button action. Processing occurs in Express with server validation and database access. Output is JSON used to update the React page and display a confirmation, changed badge, availability, or useful error [1, 4].')
    put(56, '2.2 Design of the module', 'Heading 2')
    put(57, 'POST /api/auth/register accepts {name,email,password}; the server normalizes email, validates lengths, hashes with bcrypt cost 12 and inserts a unique student account. POST /api/auth/login compares the password hash; both establish an eight-hour opaque session in an HttpOnly, SameSite=Lax cookie. POST /api/auth/logout invalidates it. GET /api/events accepts search/category parameters; GET /api/events/:id returns details and only the current user’s registration. POST /api/events/:id/register runs duplicate, date, open-status and seat checks inside BEGIN IMMEDIATE before inserting or reactivating one registration. GET /api/registrations filters by session user; DELETE /api/registrations/:id checks both user ownership and event time. JSON errors use appropriate 400/401/403/404/409 statuses. HTML constraints assist the user; the server repeats all rules [5, 6].')
    put(58, '2.3 Development of the module', 'Heading 2')
    put(59, 'Actual password hashing excerpt — server/app.js:')
    app_source = (ROOT / 'server/app.js').read_text()
    hash_line = next(line.strip() for line in app_source.splitlines() if 'const hash = await bcrypt.hash' in line)
    p = insert_after(paragraphs[59], hash_line, 'Code Snippet')
    p = insert_after(p, 'Actual booking checks inside transaction(db, ...) — server/app.js:')
    start = app_source.index("      requireValue(existing?.status !== 'CONFIRMED'")
    stop = app_source.index('\n      db.prepare', start)
    checks = '\n'.join(line.strip() for line in app_source[start:stop].splitlines())
    insert_after(p, checks, 'Code Snippet')
    put(61, '2.4 Results', 'Heading 2')
    put(62, 'The real Chromium walkthrough verified discovery filters and empty states, account creation, rejected credentials, booking confirmation, changed availability, persistent dashboard status and cancellation. API checks also reject duplicates, full/closed/past events and another student’s cancellation. Figures 1–3 show the running application with fictional development data.')
    add_figures(paragraphs[62], [
        ('01b-events.png', 'Figure 1. Database-driven discovery with category filters and search.'),
        ('02-event-registration.png', 'Figure 2. Event details after a successful student registration; availability is updated.'),
        ('03-student-dashboard.png', 'Figure 3. The student dashboard displays a persisted confirmed registration.'),
    ])

    put(63, '3. Student 2: [STUDENT 2 NAME] (Reg. No: [STUDENT 2 REGISTRATION NUMBER])', 'Heading 1').paragraph_format.page_break_before = True
    put(64, 'Assigned modules: Organizer Event Management; Organizer Dashboard & Attendee Management.')
    put(65, '3.1 Module Description', 'Heading 2')
    put(66, 'Organizer Event Management: a protected form creates or edits a title, category, description, future date/time, venue, capacity and registration status. The studio allows deletion with confirmation. Organizer Dashboard & Attendees: summary cards display owned-event totals, confirmed bookings and upcoming open events. Each event links to its private list of confirmed students and their registration dates.')
    put(67, 'Input is an event form or management action. Express checks role and ownership, validates the payload and reads or writes SQLite. The output refreshes the studio or displays actionable validation feedback. Attendee data is never exposed by public discovery routes.')
    put(68, '3.2 Design of the module', 'Heading 2')
    put(69, 'GET /api/organizer/events scopes results to the session organizer. POST creates an event with the server-supplied organizer ID. PUT /api/organizer/events/:id requires ownership and validates future dates, category, status, text lengths and integer capacity 1–1000; a transaction prevents capacity falling below confirmed registrations. DELETE checks ownership and cascades associated registrations. GET /api/organizer/events/:id/attendees returns only confirmed students for an owned event. Anonymous requests receive 401; student roles and unrelated organizers receive 403. React sends JSON and displays the returned database results. Summary counts are derived from this owned-event data, not hardcoded [4, 5].')
    put(70, '3.3 Development of the module', 'Heading 2')
    put(71, 'Actual ownership guard — server/app.js:')
    guard = next(line.strip() for line in app_source.splitlines() if 'event.organizer_id === req.user.id' in line)
    p = insert_after(paragraphs[71], guard, 'Code Snippet')
    p = insert_after(p, 'Actual capacity guard inside the update transaction — server/app.js:')
    guard = next(line.strip() for line in app_source.splitlines() if 'e.capacity >= event.registration_count' in line)
    insert_after(p, guard, 'Code Snippet')
    put(73, '3.4 Results', 'Heading 2')
    put(74, 'Chromium verified event creation, edit persistence, closing registrations, deletion and the confirmed-attendee list. API tests verified another organizer cannot edit/delete the event or inspect attendees, and students cannot use organizer endpoints. Figures 4–6 show the genuine organizer interface.')
    add_figures(paragraphs[74], [
        ('06-event-management.png', 'Figure 4. A real organizer event form completed during the browser walkthrough.'),
        ('04-organizer-studio.png', 'Figure 5. Organizer studio with event totals and confirmed registration counts.'),
        ('05-attendees.png', 'Figure 6. Private confirmed-attendee list using a fictional demo student.'),
    ])

    put(76, '4. Conclusion and Future Scope', 'Heading 1').paragraph_format.page_break_before = True
    put(77, 'CampusConnect implements six connected features in a small, explainable application.\nReact forms and views communicate with an Express API using JSON.\nSQLite persists users, events and registration history with relational constraints.\nServer validation, bcrypt, session cookies and ownership checks protect the core workflows.\nCapacity transactions prevent last-seat overbooking and support reliable cancellation.\nFocused API and Chromium checks verify the essential classroom journeys.\nThe design remains responsive and uses local assets without paid services.\nFuture work could add accessible password recovery and deployment-specific persistent sessions after this assignment.')
    p = insert_after(paragraphs[77], 'Verification and limitations', 'Heading 2')
    p = insert_after(p, 'Actual checks: ESLint passed; all 20 HTTP integration tests passed (0 failed, 0 skipped); Vite production build passed; all 10 real Chromium walkthrough steps passed; npm audit reported zero advisories after dependency updates. The browser walkthrough found no unexpected console errors or server exceptions. Screenshots were captured from a disposable SQLite database on 29 October 2026, using Asia/Kolkata for display [7]. A clean-install smoke check is recorded separately in docs/TESTING.md.')
    p = insert_after(p, 'Sessions are in memory and end on server restart; database data persists. The fixture password is public and intended only for local demos. No Lighthouse/WAVE scores, full accessibility audit, distributed load test, independent security audit or public deployment are claimed. The PDF is rendered from the completed Word content with ReportLab; its pagination differs from Word.')
    p = insert_after(p, 'Two-student demonstration checklist', 'Heading 2')
    p = insert_after(p, 'Student 1: (1) show signup and rejected/correct login; (2) search/filter events; (3) book an available event and show updated seats; (4) show the personal dashboard and cancellation; (5) re-register so Student 2 can demonstrate attendees.')
    insert_after(p, 'Student 2: (1) log in as the demo organizer; (2) create and edit a future event; (3) show owned-event statistics and a confirmed attendee; (4) close registration and explain server authorization; (5) delete only the disposable demo event. Full steps and expected outcomes are in docs/DEMO.md.')
    put(79, '5. References', 'Heading 1').paragraph_format.page_break_before = True
    put(80, 'Official sources consulted through the allowed Node.js and GitHub documentation routes (29 October 2026). Reference numbers are cited in the relevant sections. Main documentation sites restricted by the environment were not represented as successfully consulted.')
    put(82, '\n\n'.join(f'[{i}] {name}.\n{url}' for i, (name, url) in enumerate(REFERENCES, 1)))

    for table in doc.tables:
        table.style = 'Table Grid'
        header = OxmlElement('w:tblHeader')
        table.rows[0]._tr.get_or_add_trPr().append(header)
        for row_index, row in enumerate(table.rows):
            # Keep a table row intact on one page.
            row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
            for cell in row.cells:
                for p in cell.paragraphs:
                    p.paragraph_format.space_after = Pt(5)
                    p.paragraph_format.line_spacing = 1.05
                    for run in p.runs:
                        run.font.name = 'Times New Roman'
                        run.font.size = Pt(9)
                        run.font.bold = row_index == 0
    # Remove only unused template spacer paragraphs, never image-bearing paragraphs.
    for p in list(doc.paragraphs):
        if not p.text.strip() and not p._p.xpath('.//*[local-name()="drawing"]'):
            p._p.getparent().remove(p._p)
    section = doc.sections[0]
    footer = section.footer.paragraphs[0]
    footer.text = 'CampusConnect · FLEXICORE-3131                                      Page '
    field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
    for r in footer.runs:
        r.font.name = 'Times New Roman'; r.font.size = Pt(8)
    update = OxmlElement('w:updateFields'); update.set(qn('w:val'), 'true'); doc.settings.element.append(update)
    doc.core_properties.title = 'CampusConnect: Campus Event and Club Management Portal'
    doc.core_properties.author = '[STUDENT 1 NAME]; [STUDENT 2 NAME]'
    doc.core_properties.last_modified_by = 'CampusConnect report generator'
    doc.core_properties.subject = 'FLEXICORE-3131 Web Technology Project Report'
    doc.save(OUTPUT)
    print('Created editable report:', OUTPUT.relative_to(ROOT))


def add_figures(anchor, figures):
    for filename, caption in figures:
        p = insert_after(anchor)
        p.paragraph_format.page_break_before = True
        p.paragraph_format.keep_with_next = True
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(ROOT / 'docs/screenshots' / filename), width=Inches(6.2))
        anchor = insert_after(p, caption, 'Caption')
        anchor.paragraph_format.space_after = Pt(12)
        for r in anchor.runs:
            r.font.size = Pt(10)
            r.font.name = 'Times New Roman'
        anchor = insert_after(anchor, 'Source: real Chromium capture; full-resolution original in docs/screenshots/' + filename)
        for r in anchor.runs:
            r.font.size = Pt(8)


def build_pdf():
    doc = Document(OUTPUT)
    font_root = Path('/usr/share/fonts/truetype/dejavu')
    for label, file in [('Report','DejaVuSerif.ttf'),('Report-Bold','DejaVuSerif-Bold.ttf'),('Report-Italic','DejaVuSerif-Italic.ttf')]:
        pdfmetrics.registerFont(TTFont(label, str(font_root / file)))
    pdfmetrics.registerFontFamily('Report', normal='Report', bold='Report-Bold', italic='Report-Italic', boldItalic='Report-Bold')
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='BodyReport',fontName='Report',fontSize=10,leading=14,spaceAfter=9,splitLongWords=True))
    styles.add(ParagraphStyle(name='TitleReport',parent=styles['BodyReport'],fontName='Report-Bold',fontSize=18,leading=23,alignment=TA_CENTER,spaceAfter=18))
    styles.add(ParagraphStyle(name='CenterReport',parent=styles['BodyReport'],alignment=TA_CENTER,spaceAfter=12))
    styles.add(ParagraphStyle(name='H1Report',parent=styles['BodyReport'],fontName='Report-Bold',fontSize=15,leading=20,spaceBefore=12,spaceAfter=10,keepWithNext=True))
    styles.add(ParagraphStyle(name='H2Report',parent=styles['BodyReport'],fontName='Report-Bold',fontSize=12,leading=17,spaceBefore=9,spaceAfter=7,keepWithNext=True))
    styles.add(ParagraphStyle(name='CellReport',parent=styles['BodyReport'],fontSize=8,leading=11,spaceAfter=0))
    styles.add(ParagraphStyle(name='CaptionReport',parent=styles['BodyReport'],fontName='Report-Italic',fontSize=9,leading=13))
    styles.add(ParagraphStyle(name='CodeReport',fontName='Courier',fontSize=8.5,leading=11.5,spaceAfter=10))
    flow = []
    body_width = A4[0] - 112
    for node in doc.element.body:
        if node.tag == qn('w:p'):
            p = WordParagraph(node, doc)
            if p.paragraph_format.page_break_before:
                flow.append(PageBreak())
            for drawing in p._p.xpath('.//*[local-name()="drawing"]'):
                blip = drawing.xpath('.//*[local-name()="blip"]')[0]
                part = doc.part.related_parts[blip.get(qn('r:embed'))]
                extent = drawing.xpath('.//*[local-name()="extent"]')[0]
                width = int(extent.get('cx')) / 914400 * 72
                height = int(extent.get('cy')) / 914400 * 72
                scale = min(1, body_width / width, 590 / height)
                flow.append(Image(BytesIO(part.blob),width=width*scale,height=height*scale))
                flow.append(Spacer(1,9))
            if not p.text.strip():
                continue
            if p.style.name == 'Code Snippet':
                # Wrap actual code only for layout; preserve its characters and wording.
                import textwrap
                lines = '\n'.join('\n'.join(textwrap.wrap(line,90,subsequent_indent='  ',break_long_words=True)) for line in p.text.splitlines())
                flow.append(Preformatted(lines,styles['CodeReport']))
                continue
            style = styles['H1Report'] if p.style.name == 'Heading 1' else styles['H2Report'] if p.style.name == 'Heading 2' else styles['CaptionReport'] if p.style.name == 'Caption' else styles['CenterReport'] if p.alignment == WD_ALIGN_PARAGRAPH.CENTER else styles['BodyReport']
            if p.text.startswith('CampusConnect\n'):
                style = styles['TitleReport']
            content = escape(p.text).replace('\n','<br/>')
            # Make reference URLs usable in the PDF.
            content = re.sub(r'(https://[^<\s]+)',r'<link href="\1" color="#315c44">\1</link>',content)
            flow.append(Paragraph(content,style))
        elif node.tag == qn('w:tbl'):
            table = WordTable(node, doc)
            rows = [[Paragraph(escape(cell.text).replace('\n','<br/>'),styles['CellReport']) for cell in row.cells] for row in table.rows]
            widths = [body_width*x for x in ([.05,.17,.17,.41,.20] if len(rows[0])==5 else [.35,.65])]
            rendered = Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
            rendered.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.HexColor('#c2cbbd')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf0e7')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
            flow.extend([rendered,Spacer(1,12)])
    def footer(canvas, _doc):
        canvas.saveState(); canvas.setFont('Report',8); canvas.setFillColor(colors.HexColor('#69715e'))
        canvas.drawString(56,31,'CampusConnect · FLEXICORE-3131'); canvas.drawRightString(A4[0]-56,31,f'Page {canvas.getPageNumber()}'); canvas.restoreState()
    pdf = SimpleDocTemplate(str(PDF),pagesize=A4,rightMargin=56,leftMargin=56,topMargin=48,bottomMargin=50,title='CampusConnect Project Report',author='[STUDENT 1 NAME]; [STUDENT 2 NAME]')
    pdf.build(flow,onFirstPage=footer,onLaterPages=footer)
    print('Created PDF reading copy:', PDF.relative_to(ROOT))


if __name__ == '__main__':
    if '--pdf-only' not in sys.argv:
        build_word()
    build_pdf()
