import { privacyPolicy, tnc } from "@/lib/constant";
import Image from "next/image";
import Link from "next/link";
import { Text } from ".//text";

const Footer = () => {
  const socialLinks = [
    {
      icon: <Image src="/discord.svg" alt="Discord" width={20} height={20} />,
      url: "https://discord.com/AvailProject",
      name: "Discord",
    },
    {
      icon: <Image src="/x.svg" alt="X" width={20} height={20} />,
      url: "https://x.com/AvailProject",
      name: "X",
    },
    {
      icon: <Image src="/telegram.svg" alt="telegram" width={20} height={20} />,
      url: "https://t.me/AvailCommunity",
      name: "Telegram",
    },
    {
      icon: <Image src="/github.svg" alt="Github" width={30} height={30} />,
      url: "https://github.com/availproject/",
      name: "Github",
    },
    {
      icon: <Image src="/linkedin.svg" alt="LinkedIn" width={16} height={16} />,
      url: "https://www.linkedin.com/company/availproject/",
      name: "LinkedIn",
    },
  ];

  return (
    <footer className="fixed bottom-0 w-full bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] border-t border-border-grey px-4 py-1.5 z-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Text size={"xs"} className="text-[#FFFFFFB2]" weight={"bold"}>
            V1
          </Text>
          <div className="w-px bg-border-grey h-5" />
          <Image src="/wifi.svg" alt="Wifi" width={20} height={20} />
          <div className="w-px bg-border-grey h-5" />
          <Link href={tnc} target="_blank">
            <Text weight={"bold"} size={"xs"}>
              Terms & Conditions
            </Text>
          </Link>
          <div className="w-px bg-border-grey h-5" />
          <Link href={privacyPolicy} target={"_blank"}>
            <Text weight={"bold"} size={"xs"}>
              Privacy Policy
            </Text>
          </Link>
        </div>

        <div className="flex items-center gap-x-3">
          {socialLinks.map((link, index) => (
            <Link
              key={index}
              href={link.url}
              className="w-5 h-5 flex justify-center items-center"
            >
              {link.icon}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
