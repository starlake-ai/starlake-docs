// import React from "react";
// import { FaGithub, FaLinkedin, FaSlack } from "react-icons/fa"; // Using react-icons for icons
// import "./customFooterStyles.css";

// export default function CustomFooter() {
//   const handleClickJoin = () => {
//     window.open(
//       "https://join.slack.com/t/starlakeai/shared_invite/zt-28vf5d49s-rnyuh70OrJjcX_2Vz2mafw",
//       "_blank"
//     );
//   };
//   const handleClickTry = () => {
//     window.open("https://github.com/starlake-ai/starlake", "_blank");
//   };
//   const handleClickLink = () => {
//     window.open(
//       "https://www.linkedin.com/company/starlake-ai/mycompany/",
//       "_blank"
//     );
//   };
const content = {
  footer: {
    company: {
      name: "STARLAKE.AI",
      description: "StarLake",
    },
    copyright: {
      text: "Copyright © 2024 ",
      company: "Starlake.ai",
      companyLink: "https://starlake.ai",
    },
  },
};

//   return (
//     <footer className="custom_footer bg-light text-center text-lg-start text-muted mt-5 pt-3">
//       <section className="custom_footer-section mt-5">
//         <div className="custom_footer-container text-center text-md-start">
//           <div
//             style={{
//               display: "flex",
//               justifyContent: "space-between",
//               alignItems: "center",
//               flexDirection: "row",
//             }}
//             className="custom_footer-row mt-3"
//           >
//             <div className="custom_footer-col-md-3 custom_footer-col-lg-4 custom_footer-col-xl-3 custom_footer-mx-auto mb-4">
//               <h6 className="text-uppercase fw-bold mb-4 custom_footer-title">
//                 {content.footer.company.name}
//               </h6>
//             </div>

//             <div className="custom_footer-col-md-4 custom_footer-col-lg-3 custom_footer-col-xl-3 custom_footer-mx-auto mb-md-0 mb-4">
//               <h6 className="text-uppercase fw-bold mb-4 custom_footer-title">
//                 Resources
//               </h6>
//               <p>
//                 <a href="/termsAndConditions" className="custom_footer-link">
//                   Docs
//                 </a>
//               </p>
//               <p>
//                 <a href="/termsAndConditions" className="custom_footer-link">
//                   Blog
//                 </a>
//               </p>
//               <p
//                 className="custom_footer-social-icons"
//                 style={{ fontSize: "20px" }}
//               >
//                 <a
//                   onClick={handleClickLink}
//                   className="custom_footer-link custom_footer-social-icon"
//                 >
//                   <FaLinkedin size={24} className="me-2" />
//                 </a>
//                 <a
//                   onClick={handleClickJoin}
//                   className="custom_footer-link custom_footer-social-icon"
//                 >
//                   <FaSlack size={24} className="me-2" />
//                 </a>
//                 <a
//                   onClick={handleClickTry}
//                   className="custom_footer-link custom_footer-social-icon"
//                 >
//                   <FaGithub size={24} className="me-2" />
//                 </a>
//               </p>
//             </div>
//           </div>
//         </div>
//       </section>

//       <div className="text-center p-2 custom_footer-copyright">
//         {content.footer.copyright.text}&nbsp;
//         <a
//           className="custom_footer-link fw-bold"
//           href={content.footer.copyright.companyLink}
//         >
//           {content.footer.copyright.company}
//         </a>
//       </div>
//     </footer>
//   );
// }

import React from "react";
import { FaGithub, FaLinkedin, FaSlack } from "react-icons/fa"; // Using react-icons for icons

// import "./Footer.css"; // Import the custom CSS file

export default function Footer() {
  const handleClickJoin = () => {
    window.open(
      "https://join.slack.com/t/starlakeai/shared_invite/zt-28vf5d49s-rnyuh70OrJjcX_2Vz2mafw",
      "_blank"
    );
  };
  const handleClickTry = () => {
    window.open("https://github.com/starlake-ai/starlake", "_blank");
  };
  const handleClickLink = () => {
    window.open(
      "https://www.linkedin.com/company/starlake-ai/mycompany/",
      "_blank"
    );
  };

  return (
    <footer className="footer">
      <section className="footer-section">
        <div className="footer-container">
          <div className="footer-col">
            <h6 className="footer-title ">{content.footer.company.name}</h6>
          </div>

          <div className="footer-col">
            <h6 className="footer-title tl">Resources</h6>
            <p className="tl">
              <a href="/termsAndConditions" className="footer-link">
                Docs
              </a>
            </p>
            <p className="tl">
              <a href="/termsAndConditions" className="footer-link">
                Blog
              </a>
            </p>
            <div className="footer-social-icons tl">
              <a onClick={handleClickLink} className="footer-link">
                <FaLinkedin size={24} className="me-2" />
              </a>
              <a onClick={handleClickJoin} className="footer-link">
                <FaSlack size={24} className="me-2" />
              </a>
              <a onClick={handleClickTry} className="footer-link">
                <FaGithub size={24} className="me-2" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="footer-bottom">
        {content.footer.copyright.text}&nbsp;
        <a
          className="footer-link footer-link-bold"
          href={content.footer.copyright.companyLink}
        >
          {content.footer.copyright.company}
        </a>
      </div>
    </footer>
  );
}
