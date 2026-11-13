"use client";

import { useState } from "react";
import styles from "./support.module.css";
import { OFFICE_EMAIL } from "@/lib/business-contact";

const SECTIONS = [
  { id: "design", title: "Design Prep" },
  { id: "products", title: "Products" },
  { id: "technical", title: "Technical" },
  { id: "customization", title: "Customization" },
  { id: "files", title: "Files & Orders" },
];

export default function SupportPage() {
  const [activeSection, setActiveSection] = useState("design");

  return (
    <div className={styles["support-page"]}>
      <div className={styles["support-header"]}>
        <div className={styles.container}>
          <h1>Support & FAQ</h1>
          <p>Everything you need to know about creating perfect custom stickers</p>
        </div>
      </div>

      <div className={styles["support-nav"]}>
        <div className={styles.container}>
          <div className={styles["nav-buttons"]}>
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles["nav-button"]} ${activeSection === section.id ? styles.active : ""}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles["support-content"]}>
        <div className={styles.container}>
          {activeSection === "design" && (
            <div className={styles["content-section"]}>
              <h2>Design Preparation</h2>
              <div className={styles["faq-item"]}>
                <h3>RGB vs. CMYK</h3>
                <p>When producing your sticker in Photoshop, Procreate, or Illustrator make sure to work in CMYK mode. The color accuracy will improve and print to your expectations.</p>
                <div className={styles["instruction-group"]}>
                  <h4>In Photoshop:</h4>
                  <ol>
                    <li>Upload file in Photoshop</li>
                    <li>Go to Image → Mode → CMYK</li>
                  </ol>
                </div>
                <div className={styles["instruction-group"]}>
                  <h4>In Illustrator:</h4>
                  <ol>
                    <li>Upload file in Illustrator</li>
                    <li>Go to File → Document color mode → CMYK</li>
                  </ol>
                </div>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Creating Cutlines</h3>
                <p>There are several different paths to creating your cutline. Before beginning, make sure you like the size of your design.</p>
                <ol>
                  <li>Make sure your design is vectorized</li>
                  <li>Go to Pathfinder → Merge → Unite</li>
                  <li>Add spot colors 0,100,0,0 (CMYK) and name it &quot;die cut&quot;</li>
                  <li>You&apos;re all set!</li>
                </ol>
                <div className={styles.tip}>
                  <strong>Want to skip this process?</strong> Leave us a comment in our Sticker Maker comment box with instructions for your cutline.
                </div>
              </div>
            </div>
          )}

          {activeSection === "products" && (
            <div className={styles["content-section"]}>
              <h2>Product Types</h2>
              <div className={styles["faq-item"]}>
                <h3>Custom Sticker Sheets</h3>
                <ol>
                  <li>Begin by choosing your size. We have some pre-set sizes but you can also choose your own size.</li>
                  <li>Pick your quantity of sticker sheets you&apos;d like</li>
                  <li>Then choose the material you want</li>
                  <li>You can choose between: holographic, clear, window perf, and matte vinyl</li>
                  <li>Next, upload your design to our Sticker Maker</li>
                  <li>Place your sticker and cutline wherever you desire on the sheet</li>
                  <li>Ensure your design page is the same size as your sticker sheet</li>
                  <li>Leave us a comment in our Sticker Maker for any special requests</li>
                  <li>Upload your file as a PDF and you&apos;re ready to go!</li>
                </ol>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Window Stickers</h3>
                <p>Window stickers are available in only one material – clear.</p>
                <ol>
                  <li>Begin by choosing your size. We have some pre-set sizes but you can also choose your own size.</li>
                  <li>Pick your quantity of window stickers you&apos;d like</li>
                  <li>Choose &quot;clear&quot; for material</li>
                  <li>Next, upload your design to our Sticker Maker</li>
                  <li>In our Sticker Maker comment box, write &quot;window&quot;. This will inform us that you would like the image to be reversed so the sticker can be applied on the interior and visible correctly from the exterior.</li>
                  <li>You&apos;re all set!</li>
                </ol>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Hang Tag Stickers</h3>
                <p>Yes, we can make hang tag stickers. These are stickers with an extra space and a hole cutout to be used as hang tags.</p>
                <p>In a nutshell, hang tag stickers easily provide customers with essential product information in a short and sweet way, while also adding a professional touch to the products.</p>
                <p>Our hang tag stickers are available in a variety of shapes, sizes, and materials depending on your specific needs. They can be made from paper, vinyl, or other materials and display logos, graphics, or text.</p>
                <div className={styles.tip}>
                  You can add your own cutline or write us a comment in our Sticker Maker so we can customize your design.
                </div>
              </div>
            </div>
          )}

          {activeSection === "technical" && (
            <div className={styles["content-section"]}>
              <h2>Technical Questions</h2>
              {[
                { q: "Can you print in RGB?", a: "No, we print in CMYK. RGB is for uses such as a computer or phone. Printing in CMYK will create stickers more accurately." },
                { q: "Can you print gradients on stickers?", a: "Yes, we can!" },
                { q: "Can you print photos/illustrations as stickers?", a: "Yes, we can!" },
                { q: "Can you print white ink on transparent stickers?", a: "Yes! We can print white ink on compatible clear vinyl with our UV printer. Request white artwork or a white base beneath color, and we will confirm the placement in your proof." },
                { q: "Can you print stickers with Pantone colors?", a: "Not exactly, our printing is done within the CMYK color palette. You can save your colors as a spot color and we will print your design as close to that as possible." },
                { q: "Can you print on the back of the stickers?", a: "No, unfortunately we cannot." },
              ].map((item) => (
                <div key={item.q} className={styles["faq-item"]}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
              <div className={styles["faq-item"]}>
                <h3>Are you able to print stickers in white?</h3>
                <p>Yes! Our UV printer can print white ink, including white artwork and a white base beneath color on compatible materials.</p>
                <ul>
                  <li>On white materials, unprinted areas can show the white material itself.</li>
                  <li>On compatible clear or holographic vinyl, we can add white ink while leaving other areas transparent or holographic.</li>
                </ul>
                <p>Tell us where white ink is needed. We will confirm material compatibility and white ink placement in the proof before printing.</p>
              </div>
            </div>
          )}

          {activeSection === "customization" && (
            <div className={styles["content-section"]}>
              <h2>Customization Options</h2>
              <div className={styles["faq-item"]}>
                <h3>Can I make a custom cutline for my sticker?</h3>
                <p>Yes! You can create your own cutline. Don&apos;t forget to make sure to leave us a comment in the Sticker Maker that you have added your own cutline.</p>
                <h4>How to create your own cutline:</h4>
                <ol>
                  <li>Open up your sticker in your design software (e.g., Adobe Illustrator, Corel, etc.)</li>
                  <li>Make your cutline as a path</li>
                  <li>Make a swatch as a spot color named &quot;Die Cut&quot; and ensure the color as 100% magenta</li>
                  <li>Save your file as a PDF, AI or CDR and upload it to our Sticker Maker</li>
                </ol>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Can we make stickers without the white border?</h3>
                <p>Yes, we can! You can stretch your artwork to create a bleed, or choose your own background color, or include your own cutline on the artwork. Just leave us a comment in the Sticker Maker with any specificities!</p>
                <div className={styles.tip}>Make sure to include a 0.07&quot; bleed for the cutline for our error margins. There is slight travel in our cutting, and to avoid blank media included in the sticker, a bleed is necessary.</div>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Can we make borders around the stickers thinner?</h3>
                <p>We will proportion the thickness to the size of your stickers. However, we&apos;ll need about 0.07&quot; of padding around the stickers to account for error margins.</p>
                <p>If you have a special request for your border, please leave us a comment in the Sticker Maker.</p>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Can we cut out areas within the stickers?</h3>
                <p>Yes, we can! You can make custom cutlines for your stickers. You can also leave us a comment in our Sticker Maker to remove areas within your sticker if needed.</p>
                <p>You can also attach your own design and cutline for us to use when we produce your stickers.</p>
                <div className={styles.tip}>Please leave us a comment in our Sticker Maker so we do not miss parts of your desired cutline.</div>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Can we make stickers with sharp corners?</h3>
                <p>Yes, we can cut sharp corners.</p>
                <p>Include your custom cutline in the PDF you attach to our Sticker Maker, or leave us a comment with your desired cut and we&apos;ll add it to the final product.</p>
              </div>
            </div>
          )}

          {activeSection === "files" && (
            <div className={styles["content-section"]}>
              <h2>File Preparation</h2>
              <div className={styles["faq-item"]}>
                <h3>What type of files do we accept?</h3>
                <p>We accept PDF, PNG, JPEG, SVG, AI, and CDR files. Don&apos;t forget to have your files in CMYK to support the most accurate outcomes of your colors.</p>
              </div>
              <div className={styles["faq-item"]}>
                <h3>What if my art&apos;s resolution is low?</h3>
                <p>PDF, AI, and CDR files will have the highest possible resolution and offer you the best product outcome, as long as the file is vectorized.</p>
                <p><strong>Low resolution options:</strong> If your file has a low resolution warning your design will most likely come out looking alright, but the lines and shapes may be affected. To combat this, we suggest you to vectorize your file or have a minimum of 300 DPI in the final scale of your print.</p>
                <div className={styles.tip}>If you have any questions about the resolution of your file, please email us {OFFICE_EMAIL} and we can help you get the best image possible.</div>
              </div>
              <div className={styles["faq-item"]}>
                <h3>Can you help me with touch ups to my art?</h3>
                <p>We can cooperate with you to help prepare your designs for print. Feel free to email us at {OFFICE_EMAIL} and we can help you adjust your artwork to the best of our abilities.</p>
              </div>
              <div className={styles["faq-item"]}>
                <h3>What is our minimum order for custom stickers?</h3>
                <p>The minimum order for die-cut custom stickers is $25. The number of stickers will depend on the size of your design. The color and cut distance don&apos;t affect the price.</p>
                <p>You can check out our custom sticker page to see our regular prices.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles["contact-section"]}>
        <div className={styles.container}>
          <h2>Still have questions?</h2>
          <p>Contact us at <a href={`mailto:${OFFICE_EMAIL}`}>{OFFICE_EMAIL}</a></p>
        </div>
      </div>
    </div>
  );
}
