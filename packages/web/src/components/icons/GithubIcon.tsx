import { SVGProps } from "react";
import { siGithub } from "simple-icons";

export const GithubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    dangerouslySetInnerHTML={{ __html: siGithub.svg }}
    {...props}
  />
);
