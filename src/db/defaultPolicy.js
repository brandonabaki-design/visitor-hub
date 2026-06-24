// Default safeguarding / child-protection acknowledgment shown at check-in.
// Stored as version 1 on first run; admins can edit and publish new versions.
// Body is trusted HTML authored here (not user input) and rendered as-is.
//
// NOTE: The legal references below are drawn from secondary sources and general
// knowledge; the school should review and adapt this text (via the admin policy
// editor) to match its regulator (KHDA / ADEK / MoE) and verify article-level
// citations against official sources before relying on it for compliance.

export const defaultPolicy = {
  version: 1,
  title: 'Child Protection & Safeguarding — Visitor Acknowledgment',
  body: `
<p>The safety and wellbeing of every child is our highest priority. In line with
the UAE Child Rights Law (Wadeema's Law, Federal Law No. 3 of 2016), which protects
every child in the UAE, and the safeguarding requirements of our education regulator,
all visitors, contractors, agency staff and volunteers must read and agree to the
following before entering the school.</p>

<h3>While you are on site, you agree to:</h3>
<ul>
  <li><strong>Wear your visitor badge</strong> visibly at all times and return it when you sign out.</li>
  <li><strong>Remain with your host</strong> or an authorised staff member, stay only in areas authorised for your visit, and accept that you may be escorted at the school's discretion. Do not enter classrooms, toilets, or changing areas unaccompanied.</li>
  <li><strong>Have no unsupervised contact</strong> with any student at any time, and not exchange personal contact details with students.</li>
  <li><strong>Not photograph, film, or record</strong> students, staff, or school activities, and not share any images of children, without prior written permission from the school administration.</li>
  <li><strong>Keep mobile and recording devices put away</strong> in areas where children are present, except for the legitimate purpose of your visit.</li>
  <li><strong>Follow all health, safety, and emergency instructions</strong>, including fire evacuation and roll-call procedures and any directions given by staff.</li>
  <li><strong>Comply with the school's Child Protection &amp; Safeguarding Policy, Code of Conduct, and site rules</strong> for the full duration of your visit.</li>
</ul>

<h3>Your duty to report:</h3>
<p>Under Wadeema's Law you have a duty to report any suspected harm, abuse, neglect,
or risk to a child immediately. Report any safeguarding concern — anything that
worries you about a child's safety or wellbeing — at once to your host or to the
school's Designated Safeguarding Lead / Child Protection Coordinator at reception.
The identities of anyone involved in a concern, including the person reporting it,
are kept strictly confidential.</p>

<h3>You also confirm that:</h3>
<ul>
  <li>The identity details you have provided are accurate.</li>
  <li>You are not subject to any restriction, order, or condition that would make it inappropriate for you to be on a school site or in contact with children.</li>
  <li>You understand the school may refuse or revoke entry at its discretion to protect students and staff.</li>
</ul>

<p>The personal information you provide is collected only to manage your visit and
maintain a safe-site record, and is handled in accordance with the UAE Personal
Data Protection Law (Federal Decree-Law No. 45 of 2021). It is retained for a
limited period, is accessible to authorised staff only, and you may ask to access,
correct, or delete it by contacting the school.</p>

<p><em>By submitting this form you confirm that you have read, understood, and
agree to abide by this Child Protection &amp; Safeguarding policy for the duration
of your visit. This confirmation, your name, and the timestamp are recorded as your
acknowledgment.</em></p>
`.trim(),
};

export default defaultPolicy;
