import Image from "next/image";

const useTokenMap = () => {
  const tokenMap = [
    {
      label: "AVAIL",
      icon: (
        <Image
          src={"/avail-icon.ico"}
          alt="avail logo"
          width={18}
          height={18}
        />
      ),
      value: "avail",
    },
    {
      label: "ETH",
      icon: (
        <Image
          src={"/currency/eth.png"}
          alt="ethereum logo"
          width={18}
          height={18}
        />
      ),
      value: "ethereum",
    },
  ];
  return tokenMap;
};

export default useTokenMap;
