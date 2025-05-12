import { turboDADocLink } from "@/lib/constant";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Text } from ".//text";
import Button from "./button";

async function Header() {
  return (
    <header className="sticky top-0 z-2 w-full h-16 bg-linear-[89deg] from-darker-blue from-[22.12%] to-dark-blue to-[99.08%] border-b border-b-border-grey shadow-primary px-10 flex items-center justify-between">
      <div className="flex gap-x-3 items-center">
        <Image alt="Avail logo" src="/logo.svg" width={110} height={32} />
        <Text
          size={"xs"}
          weight={"semibold"}
          className="border border-grey rounded-full px-3 h-[26px] flex justify-center items-center pt-px"
        >
          Mainnet
        </Text>
      </div>
      <div className="flex items-center justify-between gap-x-6 h-full">
        <Link
          href={turboDADocLink}
          target="_blank"
          className="flex gap-x-1.5 items-center border-x border-x-border-grey px-6 h-full"
        >
          <Text size={"base"} weight={"bold"}>
            Go to Docs
          </Text>
          <ArrowUpRight size={20} color="#FFFFFF" />
        </Link>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" component="div">
            <Button className="w-[137px] h-10">Sign In</Button>
          </SignInButton>
        </SignedOut>
      </div>
    </header>
  );
}

export default Header;
