import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { cleanNumber, getField, extractXmlRecords } from './routes/import.routes.ts';

test('cleanNumber handles Algerian/French space-separated and non-breaking space numbers', () => {
  assert.equal(cleanNumber('37 450.00'), 37450);
  assert.equal(cleanNumber('37\u00A0450.00'), 37450);
  assert.equal(cleanNumber('74 900,50'), 74900.5);
  assert.equal(cleanNumber('36380.00'), 36380);
  assert.equal(cleanNumber(2), 2);
  assert.equal(cleanNumber('0.00'), 0);
  assert.equal(cleanNumber(null), 0);
  assert.equal(cleanNumber(undefined), 0);
});

test('extractXmlRecords extracts nested products array', () => {
  const parser = new XMLParser();
  const xml = `
    <FLB_DATABASE>
      <ARTICLES>
        <ARTICLE>
          <REF>REF-MKT-01</REF>
          <DESIGNATION>Makita Drill</DESIGNATION>
          <QTE>15</QTE>
          <PRIX_ACHAT>8500</PRIX_ACHAT>
        </ARTICLE>
        <ARTICLE>
          <REF>REF-BSH-02</REF>
          <DESIGNATION>Bosch Grinder</DESIGNATION>
          <QTE>8</QTE>
          <PRIX_ACHAT>7200</PRIX_ACHAT>
        </ARTICLE>
      </ARTICLES>
    </FLB_DATABASE>
  `;
  const parsed = parser.parse(xml);
  const items = extractXmlRecords(parsed);
  assert.equal(items.length, 2);
  assert.equal(items[0].REF, 'REF-MKT-01');
  assert.equal(items[1].REF, 'REF-BSH-02');
});

test('extractXmlRecords handles user exact FLB Bon format with Qts and PrixVente', () => {
  const userFlbXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Bon>
  <Product>
    <PrdRef>TEL/2778</PrdRef>
    <OrgDesign>TEL PORTABLE SAMSUNG A16 4/128GB</OrgDesign>
    <Design>TEL PORTABLE SAMSUNG A16 4/128GB</Design>
    <Qts>2</Qts>
    <Remise>0.00</Remise>
    <PrixVente>36380.00</PrixVente>
    <MottantHt>72760.00</MottantHt>
    <TVA>0</TVA>
    <TauxTVA>0.00</TauxTVA>
    <Mottant>72760.00</Mottant>
  </Product>
  <Product>
    <PrdRef>TEL/3062</PrdRef>
    <OrgDesign>TEL PORTABLE HONOR X6C 6/128GB</OrgDesign>
    <Design>TEL PORTABLE HONOR X6C 6/128GB</Design>
    <Qts>2</Qts>
    <Remise>0.00</Remise>
    <PrixVente>37\u00A0450.00</PrixVente>
    <MottantHt>74\u00A0900.00</MottantHt>
    <TVA>0</TVA>
    <TauxTVA>0.00</TauxTVA>
    <Mottant>74\u00A0900.00</Mottant>
  </Product>
</Bon>`;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    isArray: (name) => ['product', 'article', 'item', 'row'].includes(name.toLowerCase()),
  });

  const parsed = parser.parse(userFlbXml);
  const items = extractXmlRecords(parsed);
  assert.equal(items.length, 2);

  // Item 1
  const ref1 = getField(items[0], ['PrdRef', 'ref']);
  const design1 = getField(items[0], ['Design', 'OrgDesign']);
  const qty1 = cleanNumber(getField(items[0], ['Qts', 'qty']));
  const cost1 = cleanNumber(getField(items[0], ['PrixAchat', 'PrixVente']));

  assert.equal(ref1, 'TEL/2778');
  assert.equal(design1, 'TEL PORTABLE SAMSUNG A16 4/128GB');
  assert.equal(qty1, 2);
  assert.equal(cost1, 36380);

  // Item 2 (with non-breaking space)
  const ref2 = getField(items[1], ['PrdRef', 'ref']);
  const design2 = getField(items[1], ['Design', 'OrgDesign']);
  const qty2 = cleanNumber(getField(items[1], ['Qts', 'qty']));
  const cost2 = cleanNumber(getField(items[1], ['PrixAchat', 'PrixVente']));

  assert.equal(ref2, 'TEL/3062');
  assert.equal(design2, 'TEL PORTABLE HONOR X6C 6/128GB');
  assert.equal(qty2, 2);
  assert.equal(cost2, 37450);
});

test('extractXmlRecords handles single item without error', () => {
  const parser = new XMLParser({
    isArray: (name) => ['product'].includes(name.toLowerCase()),
  });
  const xml = `
    <products>
      <product>
        <code>REF-001</code>
        <name>Item Single</name>
        <quantity>10</quantity>
      </product>
    </products>
  `;
  const parsed = parser.parse(xml);
  const items = extractXmlRecords(parsed);
  assert.equal(items.length, 1);
  assert.equal(items[0].code, 'REF-001');
});
